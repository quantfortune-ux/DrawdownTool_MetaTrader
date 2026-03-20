//+------------------------------------------------------------------+
//|                                                        gridd.mq5 |
//|                                  Copyright 2021, MetaQuotes Ltd. |
//|                                             https://www.mql5.com1 |
//+------------------------------------------------------------------+
#property copyright "Copyright 2021, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.00"

#include <Trade/trade.mqh>
#include <common_functions.mqh>
#include <Trade\AccountInfo.mqh> 
#include <Trade\SymbolInfo.mqh>
#include <Calendar\Calendar.mqh> 
#define CALENDAR_FILENAME "Calendar.bin" 
#property tester_file CALENDAR_FILENAME  


CALENDAR Calendar; 
string inCurrency = "USD";  

input int MagicNumber = 3452342341;
input int gridType = 1 ; // grid type 1 == Buy grid, 2 == Sell grid, 0 == both
input double lotSize = 0.01; // initial lot size 
input double targetRetracement = 50; // Target retracement % to close all orders
input double RR_Ratio = 3; // Risk Reward Ratio

input string linebreak3 = "**********************************************************"; // **********************************************************
bool enableFirstOrderTarget = true; // Enable separate target percent for 1st order.
input double firstOrderTargetPercent = 0.1; // first order target percent

input string linebreak32901 = "**********************************************************"; // **********************************************************
bool enableDynamicRetractement = true; // Enable dynamic retracement
input int dynamicRetractementSwingCount = 3; // dynamic retracement swing count
input double dynamicRetractementPercentToReduce = 20; // dynamic target retracement percentage to reduce
input double minRetractementPercent = 10; // minimun retracement after percentage

input string linebreak3201 = "**********************************************************"; // **********************************************************
//input bool enableFixedPip = true; // Enable fixed Gap in pip
double fixedGapPip = 1500; // Fixed Gap in pips 
bool enableGapinPercent = true; // Enable gap in percent
input double gapPercent = 0.5; // Gap in percent
input int dynamicGapSwingCount = 3; // dynamic Gap swing count
input double dynamicGapPercentToIncrease = 0.8; // dynamic Gap percentage to increase
input double maxGapPercent = 5; // maximum Gap after percentage

input string linebreak320401 = "**********************************************************"; // **********************************************************
input bool Use1Leverage = false; // Use 1 : 1 Leverage
input string linebreak3204022 = "**********************************************************"; // **********************************************************
input double MaxLotSize = 500; // Max lot size allowed

int orderCount = 0;
MqlDateTime todayDateTime;
int dayNumber = 0;
CTrade tradeObj;
CAccountInfo AccountInfo;
CSymbolInfo symbolInfo;
double points;
double aTRValue;
double maxOrderSize;
ulong lastOrderId = 0;
double LotFactor = 1;
ulong lastSellOrderId;
ulong lastBuyOrderId;
ulong firstSellOrderId;
ulong firstBuyOrderId;
double firstBuyOrderOpenPrice;
double firstSellOrderOpenPrice;
double takeProfitPips;
double OrderGapPips;
double finalBuyRetracementPercent, finalSellRetracementPercent;
int buySwingCount, sellSwingCount;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   
    if(!symbolInfo.Name(Symbol())) // sets symbol name
      return(INIT_FAILED);

   if(enableDynamicRetractement && targetRetracement < dynamicRetractementPercentToReduce) 
   {
      Print("targetRetracement should be greater than dynamicRetractementPercent");
      return(INIT_FAILED);
   }

   if(enableDynamicRetractement && targetRetracement < minRetractementPercent) 
   {
      Print("targetRetracement should be greater than minRetractementPercent");
      return(INIT_FAILED);
   }

    points = PointsPerPip();
    tradeObj.SetExpertMagicNumber(MagicNumber); 
    return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   
   // if (!IsMarketOpen(_Symbol, true ))
   // {
   //    Print("Market Closed! no tick processed");      
   //    return;
   // }  

   setOrderIdValues();
   setOrderCount();  
   runGrid();
   closeAllOrderinRetracementProfit();  
  
}

void runGrid()
{
   long buyOrderId = GetOpenOrderPosition(POSITION_TYPE_BUY, MagicNumber);
   long sellOrderId = GetOpenOrderPosition(POSITION_TYPE_SELL, MagicNumber);
   double Bid = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);
   if(buyOrderId <= 0 || sellOrderId <= 0)
   {
      OrderGapPips = fixedGapPip;         
      
      if (buyOrderId <= 0 && (gridType == 1 || gridType == 0))
      {
         buySwingCount = 0;
         OpenBuyOrder(lotSize, 0, 0);
         orderCount++;
         firstBuyOrderId = GetOpenOrderPosition(POSITION_TYPE_BUY, MagicNumber, firstBuyOrderOpenPrice);
         lastBuyOrderId = 0;
      }
      
      if (sellOrderId <= 0 && (gridType == 2 || gridType == 0)) 
      {        
         sellSwingCount = 0;
         OpenSellOrder(lotSize, 0, 0);
         firstSellOrderId = GetOpenOrderPosition(POSITION_TYPE_SELL, MagicNumber, firstSellOrderOpenPrice);
         lastSellOrderId = 0; 
         orderCount++;
         return;
      }  
   }
   
   if (buyOrderId > 0 && (gridType == 1 || gridType == 0))
   {
      continueGrid("Buy", buyOrderId);
   }
   
   if (sellOrderId > 0 && (gridType == 2 || gridType == 0))
   {
      continueGrid("Sell", sellOrderId);
   }
}

void continueGrid(string gridType, ulong orderId)
{
   PositionSelectById(orderId);
   double orderOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   double orderLotSize = PositionGetDouble(POSITION_VOLUME);
   double Ask = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits);
   double Bid = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);
   double priceMovement = gridType == "Buy" ? orderOpenPrice - Ask :  Bid - orderOpenPrice;
   double priceMovementPercent = NormalizeDouble(((priceMovement * 100)/orderOpenPrice), 4);
   double pipsMoved = NormalizeDouble(priceMovement / points, 0);
   double targetGapPercent = gapPercent;
   
   if (enableGapinPercent && buySwingCount >= dynamicGapSwingCount)
   {
      targetGapPercent = gapPercent + ((buySwingCount - dynamicGapSwingCount + 1) * dynamicGapPercentToIncrease);    
   }

   if (enableGapinPercent ? (priceMovementPercent >= targetGapPercent) : (pipsMoved > OrderGapPips))
   {
      
      if (gridType == "Buy" && (lastBuyOrderId  == 0 || lastBuyOrderId == orderId))
      {        
         setRetracementPercent(POSITION_TYPE_BUY);

         lastBuyOrderId = orderId;
         buySwingCount++;
         double volume = getNextRetracementOrderSize(POSITION_TYPE_BUY);
         OpenBuyOrder(volume, 0, 0);
         lastBuyOrderId = GetOpenOrderPosition(POSITION_TYPE_BUY, MagicNumber);
         //lastSellOrderId = 0;                 
      }
      else if (gridType == "Sell" && (lastSellOrderId  == 0 || lastSellOrderId == orderId))
      {
         setRetracementPercent(POSITION_TYPE_SELL);
         sellSwingCount++;
         double volume = getNextRetracementOrderSize(POSITION_TYPE_SELL);

         OpenSellOrder(volume, 0, 0);
         lastSellOrderId = GetOpenOrderPosition(POSITION_TYPE_SELL, MagicNumber);
         //lastBuyOrderId = 0;
      }
   }
}

void setRetracementPercent(ENUM_POSITION_TYPE orderType)
{
   // set the final retracement percent

   if (orderType == POSITION_TYPE_BUY)
   {
      if (enableDynamicRetractement && buySwingCount >= dynamicRetractementSwingCount)
      {
         
         finalBuyRetracementPercent = targetRetracement - ((buySwingCount + 1 - dynamicRetractementSwingCount) * dynamicRetractementPercentToReduce);
         finalBuyRetracementPercent = finalBuyRetracementPercent < minRetractementPercent ? minRetractementPercent : finalBuyRetracementPercent;
      }
      else
      {
         finalBuyRetracementPercent = targetRetracement; 
      }
   }  

   if (orderType == POSITION_TYPE_SELL)
   {
      if (enableDynamicRetractement && sellSwingCount >= dynamicRetractementSwingCount)
      {
         
         finalSellRetracementPercent = targetRetracement - ((sellSwingCount + 1 - dynamicRetractementSwingCount) * dynamicRetractementPercentToReduce);
         finalSellRetracementPercent = finalSellRetracementPercent < minRetractementPercent ? minRetractementPercent : finalSellRetracementPercent;

      }
      else
      {
         finalSellRetracementPercent = targetRetracement; 
      }
   }  
}

void closeAllOrderinRetracementProfit()
{ 
   if (firstBuyOrderId > 0)
   {
      handleRetracementProfit(POSITION_TYPE_BUY, firstBuyOrderId, lastBuyOrderId);
   }

   if (firstSellOrderId > 0)
   {
      handleRetracementProfit(POSITION_TYPE_SELL, firstSellOrderId, lastSellOrderId);
   }
}

void setOrderIdValues()
{
   if((gridType == 1  || gridType == 0)  && firstBuyOrderId == 0)
   {
      Print("setOrderIdValues start  firstBuyOrderId ", firstBuyOrderId, " lastBuyOrderId ", lastBuyOrderId, "firstBuyOrderOpenPrice ", firstBuyOrderOpenPrice);
      SetOpenOrderPositions(POSITION_TYPE_BUY, MagicNumber, firstBuyOrderId, lastBuyOrderId, buySwingCount, firstBuyOrderOpenPrice);
      finalBuyRetracementPercent = targetRetracement;
      Print("setOrderIdValues ends firstBuyOrderId ", firstBuyOrderId, " lastBuyOrderId ", lastBuyOrderId, " buySwingCount ", buySwingCount, "firstBuyOrderOpenPrice ", firstBuyOrderOpenPrice);
   }
   
   if((gridType == 2  || gridType == 0) && firstSellOrderId == 0)
   {
      SetOpenOrderPositions(POSITION_TYPE_SELL, MagicNumber, firstSellOrderId, lastSellOrderId, sellSwingCount, firstSellOrderOpenPrice);
      finalSellRetracementPercent = targetRetracement;
      //Print("firstSellOrderId ", firstSellOrderId, " lastSellOrderId ", lastSellOrderId);
   }

}

void handleRetracementProfit(ENUM_POSITION_TYPE orderType, ulong firstOrderId, ulong lastOrderId)
{
   if(firstOrderId > 0 )
   {
      PositionSelectById(firstOrderId);    
      double orderOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double orderLotSize = PositionGetDouble(POSITION_VOLUME);
      double Ask = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits);
	   double Bid = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);

      if (lastOrderId > 0)
      {
          PositionSelectById(lastOrderId);
         double lastOrderOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double priceMovement = orderType == POSITION_TYPE_BUY ? Bid - lastOrderOpenPrice : lastOrderOpenPrice - Ask;
         double swingMovement = orderType == POSITION_TYPE_BUY ? orderOpenPrice - lastOrderOpenPrice : lastOrderOpenPrice - orderOpenPrice;
         double swingPipsMovement = NormalizeDouble(swingMovement / points, 0);
         double pipsMoved = NormalizeDouble(priceMovement / points, 0);

         double retracement = NormalizeDouble(( pipsMoved / swingPipsMovement) * 100, 0);
         double finalRetracementPercent  = orderType == POSITION_TYPE_BUY ? finalBuyRetracementPercent : finalSellRetracementPercent;

         if (orderType == POSITION_TYPE_BUY )
         {
           //Print(" buy Order finalRetracementPercent firstbuyOrderId ", firstOrderId, " lastbuyOrderId ", lastOrderId, " finalbuyRetracementPercent ", finalRetracementPercent, " retracementPercent ", retracement, " swingPipsMovement ", swingPipsMovement, " pipsMoved ", pipsMoved, " Ask ", Ask, " Bid ", Bid, " lastOrderOpenPrice ", lastOrderOpenPrice);
         }

         if (retracement > finalRetracementPercent)
         {
            Print(" continue targetRetracement ", targetRetracement, " takeProfitPips ", takeProfitPips, " OrderGapPips ", OrderGapPips, "takeProfitPips ", takeProfitPips);
            closeOpenOrders(orderType, MagicNumber);           
            resetAllOrderIds(orderType);
            return;       
         }  
      } 
      else 
      {
         double priceMovement = orderType == POSITION_TYPE_BUY ? Bid - orderOpenPrice : orderOpenPrice - Ask;
         double pipsMoved = NormalizeDouble(priceMovement / points, 0);
         OrderGapPips = fixedGapPip;

         double takeProfitPips = NormalizeDouble((OrderGapPips * targetRetracement / 100) , 0);         
         double priceMovementPercent = NormalizeDouble((priceMovement * 100) / orderOpenPrice, 4);
         
         
         if ((!enableFirstOrderTarget && (pipsMoved >= takeProfitPips)) || 
            (enableFirstOrderTarget && (priceMovementPercent > firstOrderTargetPercent)))
         {
            if (enableFirstOrderTarget)
            {
               Print("1st order firstOrderTargetPercent11 ", firstOrderTargetPercent, " priceMovementPercent ", priceMovementPercent, " Bid ", Bid, "orderOpenPrice ", orderOpenPrice);
            }
            else
            {
               Print("1st order targetRetracement ", targetRetracement, " takeProfitPips ", takeProfitPips, " OrderGapPips ", OrderGapPips, "takeProfitPips ", takeProfitPips);
            }
            
            closeOpenOrders(orderType, MagicNumber);
            resetAllOrderIds(orderType);
         }
      }
   }
}

void resetAllOrderIds(ENUM_POSITION_TYPE orderType)
{
   if (orderType == POSITION_TYPE_BUY)
   {
      firstBuyOrderId = 0;
      firstBuyOrderOpenPrice = 0;
      lastBuyOrderId = 0;
      finalBuyRetracementPercent = targetRetracement;
   }

   if (orderType == POSITION_TYPE_SELL)
   {
      firstSellOrderId = 0;
      lastSellOrderId = 0;
      firstSellOrderOpenPrice = 0;
      finalSellRetracementPercent = targetRetracement;
   }    
}


bool OpenBuyOrder(double lotSize, double takeProfit, double stopLoss)
{
   double Ask = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits);
   double minStopLoss =  NormalizeDouble(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * points, _Digits);
   lotSize = LotsOptimized(lotSize);
   tradeObj.SetDeviationInPoints(30);
   if (((AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE) == 1) && (AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_BUY, lotSize, Ask) > -AccountInfoDouble(ACCOUNT_MARGIN_SO_SO))) ||
         ((AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE) == 0) && (((AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_BUY, lotSize, Ask) / AccountInfoDouble(ACCOUNT_EQUITY)) * 100) > -AccountInfoDouble(ACCOUNT_MARGIN_SO_SO))))
   {
      if(Use1Leverage && !CheckAvailableMarginFor1to1(_Symbol, lotSize, ORDER_TYPE_BUY))
      {
         Print("OpenBuyOrder failed as money is not enough to buy lot in 1: 1 leverage : ", lotSize);
         TerminalClose(0);
         return false;
      }

      bool result = tradeObj.Buy(lotSize, _Symbol, 0, stopLoss, takeProfit);
      if (!result)
      {
         Print("OrderSend failed in OpenBuyOrder #", GetLastError(), " Ask ", Ask, " allowed SL pips ", SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL), " stopLoss ", stopLoss, " takeProfit ", takeProfit);
      }

      return result;
   }
   else
   {
      Print("OpenBuyOrder failed as money is not enough to buy lot: ", lotSize);
   }

   return false;
}

bool OpenSellOrder(double lotSize, double takeProfit, double stopLoss)
{
   double Bid = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);
   double minStopLoss =  NormalizeDouble(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * points, _Digits);
   lotSize = LotsOptimized(lotSize);
   tradeObj.SetDeviationInPoints(30);
   //Print("AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE) ", AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE));
   //Print("AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_SELL, lotSize, Bid) ", AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_SELL, lotSize, Bid));
   //Print("AccountInfoDouble(ACCOUNT_MARGIN_SO_SO) ", AccountInfoDouble(ACCOUNT_MARGIN_SO_SO));
   //Print("AccountInfoDouble(ACCOUNT_EQUITY) ", AccountInfoDouble(ACCOUNT_EQUITY));
   if (((AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE) == 1) && (AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_SELL, lotSize, Bid) > -AccountInfoDouble(ACCOUNT_MARGIN_SO_SO))) ||
         ((AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE) == 0) && (((AccountInfo.FreeMarginCheck(Symbol(), ORDER_TYPE_SELL, lotSize, Bid) / AccountInfoDouble(ACCOUNT_EQUITY)) * 100) > -AccountInfoDouble(ACCOUNT_MARGIN_SO_SO))))
   {
      bool result = tradeObj.Sell(lotSize, _Symbol, Bid, stopLoss, takeProfit);
      if (!result)
      {
         Print("OrderSend failed in OpenSellOrder #", GetLastError(),  " Bid ", Bid, " allowed SL pips ", minStopLoss,  " stopLoss ", stopLoss, " takeProfit ", takeProfit);
      }

      return result;
   }
   else
   {
      Print("OpenSellOrder failed as money is not enough to sell lot: ", lotSize);
   }

   return false;
}

void setOrderCount()
{
    TimeToStruct(TimeCurrent(),todayDateTime);

  if (dayNumber == 0)
  {
      dayNumber = todayDateTime.day_of_year;
  }
  else if (dayNumber != todayDateTime.day_of_year)
  {
      orderCount = 0;
      dayNumber = todayDateTime.day_of_year;
  }
}

 
double getNextRetracementOrderSize(ENUM_POSITION_TYPE orderType)
{
   double totalBuyProfit = 0;
   double targetPrice;
   double totalSellProfit = 0;
   double lastOrderOpenPrice = 0;
   double sellOrderLoss = 0;
   double totalOrdersLoss = 0;
   double totalOrdersProfit = 0;
   double buyOrderLoss = 0;
   double tickValue = mTickValue();
   double Ask = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits);
   double Bid = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);

   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         int order_type =  PositionGetInteger(POSITION_TYPE); 
         double orderOpenPrice =  PositionGetDouble(POSITION_PRICE_OPEN); 
         
         if (PositionGetInteger(POSITION_MAGIC) != MagicNumber || PositionGetString(POSITION_SYMBOL) != _Symbol || 
            (order_type != POSITION_TYPE_BUY && order_type != POSITION_TYPE_SELL) || order_type != orderType)
         {
            continue;    
         }       

         lastOrderOpenPrice = orderOpenPrice;         
      }
   }

   if (orderType == POSITION_TYPE_BUY)
   {
      targetPrice = NormalizeDouble((Ask + ((lastOrderOpenPrice - Ask) * (finalBuyRetracementPercent / 100))), _Digits);      
   }
   else
   {
      targetPrice = NormalizeDouble((Bid - ((Bid - lastOrderOpenPrice) * (finalSellRetracementPercent / 100))), _Digits);      
   }        


   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         int order_type =  PositionGetInteger(POSITION_TYPE); 
         double orderOpenPrice =  PositionGetDouble(POSITION_PRICE_OPEN); 
         double orderSL =  PositionGetDouble(POSITION_SL);
         double orderSize =  PositionGetDouble(POSITION_VOLUME);
         
         if (PositionGetInteger(POSITION_MAGIC) != MagicNumber || PositionGetString(POSITION_SYMBOL) != _Symbol || 
            (order_type != POSITION_TYPE_BUY && order_type != POSITION_TYPE_SELL) || order_type != orderType)
         {
            continue;    
         }

         if(order_type == POSITION_TYPE_BUY && orderType == POSITION_TYPE_BUY)
         {
            totalOrdersLoss += orderOpenPrice > targetPrice ?  orderSize * ((orderOpenPrice - targetPrice) / points) * tickValue :  0;
            totalOrdersProfit += orderOpenPrice < targetPrice ? orderSize * ((targetPrice - orderOpenPrice) / points) * tickValue: 0 ;

         }

         if(order_type == POSITION_TYPE_SELL && orderType == POSITION_TYPE_SELL)
         {
            totalOrdersLoss += targetPrice > orderOpenPrice ? orderSize * ((targetPrice - orderOpenPrice) / points) * tickValue :  0;
            totalOrdersProfit += orderOpenPrice > targetPrice ? orderSize * ((orderOpenPrice - targetPrice) / points) * tickValue : 0;
         }
      }
   }

   double targetPips = NormalizeDouble((MathAbs((orderType == POSITION_TYPE_BUY ? Ask : Bid) - targetPrice) / points), 0);
   
   double totalLossToCompensate = totalOrdersLoss;
   totalLossToCompensate = totalLossToCompensate > 0 ? totalLossToCompensate : 0 ;   
   Print("retracement finalRetracementPercent ", (orderType == POSITION_TYPE_BUY ? finalBuyRetracementPercent : finalSellRetracementPercent)," targetPrice ", targetPrice, " totalLossToCompensate ", totalLossToCompensate, " totalOrdersLoss ", totalOrdersLoss, " totalOrdersProfit ", totalOrdersProfit, " targetPips ", targetPips);
   double newLotsize = RoundNumber(((totalLossToCompensate + (totalLossToCompensate / RR_Ratio)) - totalOrdersProfit) / (targetPips * tickValue), 2);
   maxOrderSize = newLotsize;
   Print("getNextRetracementOrderSize newLotsize ", newLotsize, " totalLossToCompensate ", totalLossToCompensate, " totalOrdersProfit ", totalOrdersProfit, " targetPips ", targetPips, " tickValue ", tickValue );
   
     if (newLotsize > MaxLotSize)
      {
         Print(" lot size is too big , greater than 50 lot and will be closed");
         TerminalClose(0);
         return 0;
      }
   
   return NormalizeDouble(newLotsize, 2) ;
}