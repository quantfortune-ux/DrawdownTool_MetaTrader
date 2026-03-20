#include <stderror.mqh>
//#include <stdlib.mqh>
//#include <hash.mqh> 
#include <Trade\Trade.mqh>
#include <Tools\Datetime.mqh>
#include <Calendar\Calendar.mqh>

CTrade trade;

#import "shell32.dll"
int ShellExecuteA(int hWnd, string Verb, string File, string Parameter, string Path, int ShowCommand);
#import "kernel32.dll"
void OutputDebugStringA(string msg);
#import

#define SW_SHOWNORMAL 1


#define OP_BUY 0           //Buy 
#define OP_SELL 1          //Sell 
#define OP_BUYLIMIT 2      //Pending order of BUY LIMIT type 
#define OP_SELLLIMIT 3     //Pending order of SELL LIMIT type 
#define OP_BUYSTOP 4       //Pending order of BUY STOP type 
#define OP_SELLSTOP 5      //Pending order of SELL STOP type 
//---
#define MODE_OPEN 0
#define MODE_CLOSE 3
#define MODE_VOLUME 4 
#define MODE_REAL_VOLUME 5
#define MODE_TRADES 0
#define MODE_HISTORY 1
#define SELECT_BY_POS 0
#define SELECT_BY_TICKET 1
//---
#define DOUBLE_VALUE 0
#define FLOAT_VALUE 1
#define LONG_VALUE INT_VALUE
//---
#define CHART_BAR 0
#define CHART_CANDLE 1
//---
#define MODE_ASCEND 0
#define MODE_DESCEND 1
//---
#define MODE_LOW 1
#define MODE_HIGH 2
#define MODE_TIME 5
#define MODE_BID 9
#define MODE_ASK 10
#define MODE_POINT 11
#define MODE_DIGITS 12
#define MODE_SPREAD 13
#define MODE_STOPLEVEL 14
#define MODE_LOTSIZE 15
#define MODE_TICKVALUE 16
#define MODE_TICKSIZE 17
#define MODE_SWAPLONG 18
#define MODE_SWAPSHORT 19
#define MODE_STARTING 20
#define MODE_EXPIRATION 21
#define MODE_TRADEALLOWED 22
#define MODE_MINLOT 23
#define MODE_LOTSTEP 24
#define MODE_MAXLOT 25
#define MODE_SWAPTYPE 26
#define MODE_PROFITCALCMODE 27
#define MODE_MARGINCALCMODE 28
#define MODE_MARGININIT 29
#define MODE_MARGINMAINTENANCE 30
#define MODE_MARGINHEDGED 31
#define MODE_MARGINREQUIRED 32
#define MODE_FREEZELEVEL 33
//---
#define EMPTY -1

static color CLR_BUY_ARROW = Blue;
static color CLR_SELL_ARROW = Red;
static color CLR_CROSSLINE_ACTIVE = Magenta;
static color CLR_CROSSLINE_TRIGGERED = Gray;
static int STYLE_CROSSLINE_TRIGGERED = STYLE_SOLID;
static int STYLE_CROSSLINE_ACTIVE = STYLE_DASH;
static int WIDTH_CROSSLINE_TRIGGERED = 1;
static int WIDTH_CROSSLINE_ACTIVE = 1;
static bool IS_ECN_BROKER = false;
string weekDay = "";

enum ENUM_MARKET_SESSIONS
{
    SESSION_US_FOREX,      // US Forex Session
    SESSION_US_STOCK,    // US Stock Session
    SESSION_EUROPE,  // European Session
    SESSION_ASIA     // Asian Session
         
};

ENUM_TIMEFRAMES TFMigrate(int tf)
  {
   switch(tf)
     {
      case 0: return(PERIOD_CURRENT);
      case 1: return(PERIOD_M1);
      case 5: return(PERIOD_M5);
      case 15: return(PERIOD_M15);
      case 30: return(PERIOD_M30);
      case 60: return(PERIOD_H1);
      case 240: return(PERIOD_H4);
      case 1440: return(PERIOD_D1);
      case 10080: return(PERIOD_W1);
      case 43200: return(PERIOD_MN1);
      
      case 2: return(PERIOD_M2);
      case 3: return(PERIOD_M3);
      case 4: return(PERIOD_M4);      
      case 6: return(PERIOD_M6);
      case 10: return(PERIOD_M10);
      case 12: return(PERIOD_M12);
      case 16385: return(PERIOD_H1);
      case 16386: return(PERIOD_H2);
      case 16387: return(PERIOD_H3);
      case 16388: return(PERIOD_H4);
      case 16390: return(PERIOD_H6);
      case 16392: return(PERIOD_H8);
      case 16396: return(PERIOD_H12);
      case 16408: return(PERIOD_D1);
      case 32769: return(PERIOD_W1);
      case 49153: return(PERIOD_MN1);      
      default: return(PERIOD_CURRENT);
     }
  }

ulong getLastPositionId(ENUM_POSITION_TYPE positionType, int magicNumber)
{
   ulong ticket = PositionGetTicket(PositionsTotal() - 1);
      
   if (PositionGetInteger(POSITION_MAGIC) != magicNumber || 
         PositionGetInteger(POSITION_TYPE) != positionType || 
         ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol)
   {
      return 0;
   }

   return ticket;
}


//+------------------------------------------------------------------+
//| Get value of buffers                                             |
//+------------------------------------------------------------------+
double iGetArray(const int handle,const int buffer,const int start_pos,const int count,double &arr_buffer[])
  {
   bool result=true;
   if(!ArrayIsDynamic(arr_buffer))
     {
      Print("This a no dynamic array!");
      return(false);
     }
   ArrayFree(arr_buffer);
//--- reset error code 
   ResetLastError();
//--- fill a part of the iBands array with values from the indicator buffer
   int copied=CopyBuffer(handle,buffer,start_pos,count,arr_buffer);
   if(copied!=count)
     {
      //--- if the copying fails, tell the error code 
      PrintFormat("Failed to copy data from the indicator, error code %d",GetLastError());
      //--- quit with zero result - it means that the indicator is considered as not calculated 
      return(false);
     }
   return(result);
  }



double pointsPerPip()
{
   int i;
   int digits;
   double ppp = 1;
   string symbol;
   int f = FileOpen("symbols.raw", FILE_BIN | FILE_READ);
   int count = FileSize(f) / 1936;
   for (i = 0; i < count; i++)
   {
      symbol = FileReadString(f, 12);
      if (StringFind(symbol, "EURUSD") != -1)
      {
         digits = MarketInfoMQL4(symbol, MODE_DIGITS);
         if (digits == 4)
         {
            ppp = 1;
         }
         else
         {
            ppp = 10;
         }
         break;
      }
      FileSeek(f, 1924, SEEK_CUR);
   }
   FileClose(f);
   return (ppp);
}

double PointsPerPip(string symbol = NULL)
{
   if(symbol == NULL) symbol = _Symbol;
   int digitsAdjust = 1;
   int digits = SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   
   if(digits == 3 || digits == 5)
   {
      digitsAdjust = 10;
   }

   return SymbolInfoDouble(symbol, SYMBOL_POINT) * digitsAdjust;
}



ulong GetOpenOrderPosition(ENUM_POSITION_TYPE type, int magicNumber)
{
   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         int order_type =  PositionGetInteger(POSITION_TYPE); 
         if (PositionGetInteger(POSITION_MAGIC) != magicNumber || 
               order_type != type || PositionGetString(POSITION_SYMBOL) != _Symbol)
            continue;         

         return ticket;
      }
   }   
   
   return 0;   
}

ulong GetOpenOrderPosition(ENUM_POSITION_TYPE type, int magicNumber, double& orderOpenPrice)
{
   orderOpenPrice = 0;
   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         int order_type =  PositionGetInteger(POSITION_TYPE); 
         if (PositionGetInteger(POSITION_MAGIC) != magicNumber || 
               order_type != type || PositionGetString(POSITION_SYMBOL) != _Symbol)
            continue;         

         orderOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);            
         return ticket;
      }
   }   
   
   return 0;   
}

void SetOpenOrderPositions(ENUM_POSITION_TYPE type, int magicNumber, ulong& firstOrderId, ulong& lastOrderId, int& ordersCount, double& firstOrderOpenPrice)
{
   ordersCount = 0;
   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         int order_type =  PositionGetInteger(POSITION_TYPE); 
         if (PositionGetInteger(POSITION_MAGIC) != magicNumber || 
               order_type != type || PositionGetString(POSITION_SYMBOL) != _Symbol)
            continue;         

         if (ordersCount == 0)
         {
            lastOrderId = ticket;
         }
         
         firstOrderOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);            
         firstOrderId = ticket;

         ordersCount++;
      }
   }   
   
   if (ordersCount == 1)
   {
      lastOrderId = 0;
   }

}

bool CheckAvailableMarginFor1to1(string symbol, double lots, ENUM_ORDER_TYPE order_type)
{
   // Get account information
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin_used = AccountInfoDouble(ACCOUNT_MARGIN);
   
   // Calculate our own 1:1 margin requirements for existing positions
   double estimated_margin_1to1 = 0;
   int total_positions = PositionsTotal();
   
   for(int i = 0; i < total_positions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string pos_symbol = PositionGetString(POSITION_SYMBOL);
         double pos_volume = PositionGetDouble(POSITION_VOLUME);
         double pos_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double contract_size = SymbolInfoDouble(pos_symbol, SYMBOL_TRADE_CONTRACT_SIZE);
         
         // Add to estimated 1:1 margin
         estimated_margin_1to1 += pos_volume * contract_size * pos_price;
      }
   }
   
   // Calculate available equity for new positions
   double available_for_new_trades = equity - estimated_margin_1to1;
   
   // Calculate required margin for new order
   double price;
   if(order_type == ORDER_TYPE_BUY || order_type == ORDER_TYPE_BUY_LIMIT || order_type == ORDER_TYPE_BUY_STOP)
      price = SymbolInfoDouble(symbol, SYMBOL_ASK);
   else
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
   
   double contract_size = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   double required_margin_new = lots * contract_size * price;
   
   // Add safety buffer
   double buffer = required_margin_new * 0.02; // 2% buffer
   double total_required = required_margin_new + buffer;
   
   Print("=== Available Margin Check (1:1 Leverage) ===");
   Print("Account Balance: ", balance);
   Print("Account Equity: ", equity);
   Print("Broker Margin Used: ", margin_used);
   Print("contract_size: ", contract_size);
   Print("lots: ", lots);
   Print("price: ", price);
   Print("Estimated Margin Used (1:1): ", estimated_margin_1to1);
   Print("Available for New Trades: ", available_for_new_trades);
   Print("Required for New Order: ", required_margin_new);
   Print("Total Required (with buffer): ", total_required);
   Print("Can Place Order: ", (available_for_new_trades >= total_required) ? "YES" : "NO");
   
   return (available_for_new_trades >= total_required);
}

bool PositionSelectById(ulong orderId)
{
   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0 && orderId == ticket && PositionGetString(POSITION_SYMBOL) == _Symbol) 
      {
         return true;
      }
   }

   return false;
}

int getNumOpenOrders(int magic)
{
   int num = 0;

   for (int trade = OrdersTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = OrderGetTicket(trade);

      if(ticket <= 0 || OrderGetString(ORDER_SYMBOL) != _Symbol 
         //|| (OrderGetInteger(ORDER_MAGIC) != magic
         )
      {
         continue;
      }

      num++;         
   }

   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);
      int order_type =  PositionGetInteger(POSITION_TYPE);         
      // magic number is coming as zero need to fix that. 
      //if (OrderGetInteger(ORDER_MAGIC) != magicNumber || order_type != type)
      if (ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;

     num++;
   }  

   return (num);
}

bool IsLiveNewsEventHappenedRecently(int minutesBeforeNews, int minutesAfterNews, string countryCode = "US")
{
   MqlCalendarValue  events[]; 
   string currencybase = SymbolInfoString(_Symbol,SYMBOL_CURRENCY_BASE);
   CDateTime eadate;
   datetime curdatetime = TimeTradeServer(eadate);
   datetime startTime = curdatetime - (minutesBeforeNews * 60);
   datetime endTime = curdatetime + (minutesAfterNews * 60);

   int eventsCount  = CalendarValueHistory(events, startTime, endTime, countryCode, "USD");
   ulong changeID = 0;
   int count = CalendarValueLast(changeID, events, "US", "USD");
   Print("Event happened ", eventsCount, " count ", count, " endTime ", endTime);
   if (eventsCount <= 0)
   {
      return false;
   }
   

   for(int i = 0; i < eventsCount; i++)
   {
      ulong ev2 = events[i].event_id;
      MqlCalendarEvent ev3;
      CalendarEventById(ev2,ev3);
      if(ev3.importance == CALENDAR_IMPORTANCE_HIGH || ev3.importance == CALENDAR_IMPORTANCE_MODERATE)            
      {
         Print("Event happened at ", events[i].time, " event name ", ev3.name);
         return true;            
      }
   }

   return false;
}

int nextNewsEvent = -1;
int previousNewsEvent = -1;
datetime nextNewsEventTime, previousNewsEventTime;
bool previousNewsEventPrinted = false;
bool nextNewsEventPrinted = false;

bool IsSavedNewsEventHappenedRecently(CALENDAR &Calendar, int minutesBeforeNews, int minutesAfterNews)
{
   if ((nextNewsEvent >= 0  && nextNewsEventTime >= TimeCurrent()))
   {
      if (!previousNewsEventPrinted && (previousNewsEventTime >= (TimeCurrent()  - (minutesAfterNews * 60))))
      {
         //Print("IsSavedNewsEventHappenedRecently after NewsEvent: ", Calendar[previousNewsEvent].ToString());
         DrawVerticalLine(previousNewsEventTime, Orange);
         previousNewsEventPrinted = true;
      }

      if (!nextNewsEventPrinted && (nextNewsEventTime <= (TimeCurrent()  + (minutesBeforeNews * 60))))
      {
         //Print("IsSavedNewsEventHappenedRecently before NewsEvent: ", Calendar[nextNewsEvent].ToString());
         DrawVerticalLine(nextNewsEventTime, Orange);
         nextNewsEventPrinted = true;
      }

      return (nextNewsEventTime <= (TimeCurrent()  + (minutesBeforeNews * 60))) || 
            (previousNewsEventTime >= (TimeCurrent()  - (minutesAfterNews * 60)));      
   }   

   int nextEventId = Calendar.GetPosAfter(TimeCurrent()); 
   int previousEventId = Calendar.GetPosBefore(TimeCurrent()); 
   previousNewsEventPrinted = false;
   nextNewsEventPrinted = false;

   //Print("IsSavedNewsEventHappenedRecently nextEventId: ", nextEventId, " previousEventId: ", previousEventId);


   if (nextEventId >= 0)
   {
      nextNewsEventTime = Calendar[nextEventId].time;
      nextNewsEvent = nextEventId;
   }

   if (previousEventId >= 0)
   {
      previousNewsEventTime = Calendar[previousEventId].time;
      previousNewsEvent = previousEventId;
   }

   if ((nextNewsEventTime <= (TimeCurrent()  + (minutesBeforeNews * 60))))
   {
      //Print("IsSavedNewsEventHappenedRecently before NewsEvent: ", Calendar[nextEventId].ToString());
      //DrawVerticalLine(Calendar[nextEventId].time, Orange);

   }

   if ((previousNewsEventTime >= (TimeCurrent()  - (minutesAfterNews * 60))))
   {
      //Print("IsSavedNewsEventHappenedRecently after NewsEvent: ", Calendar[previousEventId].ToString());
      //DrawVerticalLine(Calendar[previousEvent].time, Orange);
   }

   return (nextNewsEventTime <= (TimeCurrent()  + (minutesBeforeNews * 60))) ||
      (previousNewsEventTime >= (TimeCurrent()  - (minutesAfterNews * 60)));     

}



ulong GetOpenPendingOrder(ENUM_ORDER_TYPE type, int magicNumber)
{
   for (int trade = OrdersTotal() - 1; trade >= 0; trade--)
   {
      ulong orderId = OrderGetTicket(trade);    
      int order_type = OrderGetInteger(ORDER_TYPE);
      // magic number is coming as zero need to fix that. 
         //if (OrderGetInteger(ORDER_MAGIC) != magicNumber || order_type != type)
         if (OrderGetInteger(ORDER_MAGIC) != magicNumber || orderId <= 0 || order_type != type || OrderGetString(ORDER_SYMBOL) != _Symbol)
         {
            continue;      
         }

         return orderId;            
   }

   return 0;   
}

void closeOpenOrders(ENUM_POSITION_TYPE type, int magic)
{
   string caller = "";
   int total, cnt;
   color clr;
   int order_type;

   //Print("closeOpenOrders(" + type + "," + magic + ") " + caller);

   while (getNumOpenOrders(type, magic) > 0)
   {
      // while (IsTradeContextBusy())
      // {
      //    Print("closeOpenOrders(): waiting for trade context.");
      //    Sleep(MathRand() / 10);
      // }
      total = OrdersTotal();
      //RefreshRates();
      if (type == OP_BUY)
      {
         clr = CLR_SELL_ARROW;
      }
      else
      {
         clr = CLR_BUY_ARROW;
      }

      for (int trade = OrdersTotal() - 1; trade >= 0; trade--)
      {
         ulong ticket = OrderGetTicket(trade);

         int order_type = OrderGetInteger(ORDER_TYPE); 
         
         // magic number is coming as zero need to fix that. 
         //if (OrderGetInteger(ORDER_MAGIC) != magicNumber || order_type != type)
         if (ticket <= 0 || order_type != type || OrderGetString(ORDER_SYMBOL) != _Symbol)
            continue;         

         if (order_type == ORDER_TYPE_BUY_STOP || 
               order_type == ORDER_TYPE_SELL_STOP || 
               order_type == ORDER_TYPE_BUY_STOP_LIMIT || 
               order_type == ORDER_TYPE_SELL_STOP_LIMIT || 
               order_type == ORDER_TYPE_BUY_LIMIT || 
               order_type == ORDER_TYPE_SELL_LIMIT)
         {
            orderDeleteReliable(ticket);
         }            
            
      }

      for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
      {
         ulong ticket = PositionGetTicket(trade);
         int order_type =  PositionGetInteger(POSITION_TYPE);         
         // magic number is coming as zero need to fix that. 
         //if (OrderGetInteger(ORDER_MAGIC) != magicNumber || order_type != type)
         if (ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol  || order_type != type || PositionGetInteger(POSITION_MAGIC) != magic)
            continue;

         if (order_type == POSITION_TYPE_BUY || order_type == POSITION_TYPE_SELL)
         {
            int result = orderCloseReliable(ticket, PositionGetDouble(POSITION_VOLUME), 0, 999, clr);

            if (result > 0)
            {
               Print("Error happened in orderCloseReliable with code: ", result);
               return;
            }

         }      
      }      
   }
}

double LotsOptimized(double lot)
{
   //--- minimal allowed volume for trade operations
   double minlot = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
   if (lot < minlot)
   {
      lot = minlot;
      Print("Volume is less than the minimal allowed ,we use", minlot);
   }
   //--- maximal allowed volume of trade operations
   double maxlot = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MAX);
   if (lot > maxlot)
   {
      lot = maxlot;
      Print("Volume is greater than the maximal allowed,we use", maxlot);
   }
   //--- get minimal step of volume changing
   double volume_step = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_STEP);
   int ratio = (int)MathRound(lot / volume_step);
   if (MathAbs(ratio * volume_step - lot) > 0.0000001)
   {
      lot = ratio * volume_step;
      Print("Volume is not a multiple of the minimal step ,we use the closest correct volume ", ratio * volume_step);
   }

   return (ND(lot));
}

int getNumOpenOrders(int type, int magic)
{
   int num = 0;

   for (int trade = OrdersTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = OrderGetTicket(trade);

      if(ticket <= 0 || OrderGetString(ORDER_SYMBOL) != _Symbol 
         || OrderGetInteger(ORDER_TYPE) != type 
         //|| (OrderGetInteger(ORDER_MAGIC) != magic
         )
      {
         continue;
      }

      num++;         
   }

   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);
      int order_type =  PositionGetInteger(POSITION_TYPE);         
      // magic number is coming as zero need to fix that. 
      //if (OrderGetInteger(ORDER_MAGIC) != magicNumber || order_type != type)
      if (ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol || order_type != type)
         continue;

     num++;
   }  

   return (num);
}

  bool CheckStopLoss(ENUM_ORDER_TYPE type,double SL)
  {
  
   MqlTick last_tick;
   SymbolInfoTick(_Symbol,last_tick);
   double Bid=last_tick.bid;
   
   MqlTick last_tick1;
   SymbolInfoTick(_Symbol,last_tick1);
   double Ask=last_tick1.ask;

//--- get the SYMBOL_TRADE_STOPS_LEVEL level
   int stops_level=(int)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL);
   if(stops_level!=0)
     {
      //PrintFormat("SYMBOL_TRADE_STOPS_LEVEL=%d: StopLoss and TakeProfit must"+
      //            " not be nearer than %d points from the closing price",stops_level,stops_level);
     }
//---
   bool SL_check=false;
//--- check only two order types
   switch(type)
     {
      //--- Buy operation
      case  ORDER_TYPE_BUY:
        {
         //--- check the StopLoss
         SL_check=(Bid-SL>stops_level*_Point);
         //if(!SL_check)
           // PrintFormat("For order %s StopLoss=%.5f must be less than %.5f"+
           //             " (Bid=%.5f - SYMBOL_TRADE_STOPS_LEVEL=%d points)",
           //             EnumToString(type),SL,Bid-stops_level*_Point,Bid,stops_level);
         //--- check the TakeProfit
         
         return SL_check;
        }
      //--- Sell operation
      case  ORDER_TYPE_SELL:
        {
         //--- check the StopLoss
         SL_check=(SL-Ask>stops_level*_Point);
         //if(!SL_check)
         //   PrintFormat("For order %s StopLoss=%.5f must be greater than %.5f "+
         //               " (Ask=%.5f + SYMBOL_TRADE_STOPS_LEVEL=%d points)",
         //               EnumToString(type),SL,Ask+stops_level*_Point,Ask,stops_level);
         //--- check the TakeProfit
         return SL_check;
        }
      break;
     }
//--- a slightly different function is required for pending orders
   return false;
  }

double mTickValue(string symbol = NULL)
  {
   if(symbol == NULL) symbol = _Symbol;

//--- Some brokers return incorrect values for TICK_VALUE.
   long CalcMode = SymbolInfoInteger(symbol, SYMBOL_TRADE_CALC_MODE);
   if((CalcMode == SYMBOL_CALC_MODE_CFD) || (CalcMode == SYMBOL_CALC_MODE_CFDINDEX) || (CalcMode == SYMBOL_CALC_MODE_CFDLEVERAGE))
   {
      double MaxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      double Price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      double TickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double Profit = 0;
      if(OrderCalcProfit(ORDER_TYPE_BUY, symbol, 100 * MaxLot, Price, Price + TickSize, Profit) && Profit > 0)
      {
         return Profit / (100 * MaxLot);
      }
   }


   int digits = SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   int digitsAdjust = 1;

   if(digits == 3 || digits == 5)
   {
      digitsAdjust = 10;
   }


   return (digitsAdjust * SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE));
  }


void setSessionStartEndTime(ENUM_MARKET_SESSIONS session, datetime &startTime, datetime &endTime, int startTimeInMinutes, int EndTimeInMinutes)
{
   datetime current_datetime = TimeGMT();  // Get the current datetime
   MqlDateTime mql_datetime;  // Declare a MqlDateTime structure
   TimeToStruct(current_datetime, mql_datetime);  // Convert datetime to MqlDateTime structure

   switch(session)
   {
      case SESSION_US_FOREX:
         mql_datetime.hour = 13; // US Session starts at 1:00 PM UTC time
         mql_datetime.min = 0;
         startTime = StructToTime(mql_datetime); 

         mql_datetime.hour = 22; // US Session ends at 10:00 PM UTC time
         mql_datetime.min = 0;
         endTime = StructToTime(mql_datetime);           
         break;
       case SESSION_US_STOCK:
         mql_datetime.hour = 14; // US Session starts at 1:00 PM UTC time
         mql_datetime.min = 30;
         startTime = StructToTime(mql_datetime); 

         mql_datetime.hour = 21; // US Session ends at 10:00 PM UTC time
         mql_datetime.min = 30;
         endTime = StructToTime(mql_datetime);           
         break;
      case SESSION_EUROPE:
         mql_datetime.hour = 8; // European Session starts at 8:00 AM UTC time
         mql_datetime.min = 0;
         startTime = StructToTime(mql_datetime); 

         mql_datetime.hour = 17; // European Session starts at 8:00 AM UTC time
         mql_datetime.min = 0;
         endTime = StructToTime(mql_datetime);            
         break;
      case SESSION_ASIA:
         mql_datetime.hour = 0; // Asian Session starts at 12:00 AM UTC time
         mql_datetime.min = 0;
         startTime = StructToTime(mql_datetime); 

         mql_datetime.hour = 9; // Asian Session starts at 9:00 AM UTC time
         mql_datetime.min = 0;
         endTime = StructToTime(mql_datetime);         
         break;
   }

   if (startTimeInMinutes > 0)
   {
      startTime = startTime + startTimeInMinutes * 60;
   }

   if (EndTimeInMinutes > 0)
   {
      endTime = startTime + EndTimeInMinutes * 60;
   }

   

   setDSTTime(startTime, session);
   setDSTTime(endTime, session);      
}

double MarketInfoMQL4(string symbol,
                      int type)
  {
  
   MqlTick last_tick;
   SymbolInfoTick(symbol,last_tick);
   double Bid=last_tick.bid;
   MqlTick last_tick1;
   SymbolInfoTick(symbol,last_tick1);
   double Ask=last_tick1.ask;
  
   switch(type)
     {
      case MODE_LOW:
         return(SymbolInfoDouble(symbol,SYMBOL_LASTLOW));
      case MODE_HIGH:
         return(SymbolInfoDouble(symbol,SYMBOL_LASTHIGH));
      case MODE_TIME:
         return(SymbolInfoInteger(symbol,SYMBOL_TIME));
      case MODE_BID:
         return(Bid);
      case MODE_ASK:
         return(Ask);
      case MODE_POINT:
         return(SymbolInfoDouble(symbol,SYMBOL_POINT));
      case MODE_DIGITS:
         return(SymbolInfoInteger(symbol,SYMBOL_DIGITS));
      case MODE_SPREAD:
         return(SymbolInfoInteger(symbol,SYMBOL_SPREAD));
      case MODE_STOPLEVEL:
         return(SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL));
      case MODE_LOTSIZE:
         return(SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE));
      case MODE_TICKVALUE:
         return(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE));
      case MODE_TICKSIZE:
         return(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE));
      case MODE_SWAPLONG:
         return(SymbolInfoDouble(symbol,SYMBOL_SWAP_LONG));
      case MODE_SWAPSHORT:
         return(SymbolInfoDouble(symbol,SYMBOL_SWAP_SHORT));
      case MODE_STARTING:
         return(0);
      case MODE_EXPIRATION:
         return(0);
      case MODE_TRADEALLOWED:
         return(0);
      case MODE_MINLOT:
         return(SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN));
      case MODE_LOTSTEP:
         return(SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP));
      case MODE_MAXLOT:
         return(SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX));
      case MODE_SWAPTYPE:
         return(SymbolInfoInteger(symbol,SYMBOL_SWAP_MODE));
      case MODE_PROFITCALCMODE:
         return(SymbolInfoInteger(symbol,SYMBOL_TRADE_CALC_MODE));
      case MODE_MARGINCALCMODE:
         return(0);
      case MODE_MARGININIT:
         return(0);
      case MODE_MARGINMAINTENANCE:
         return(0);
      case MODE_MARGINHEDGED:
         return(0);
      case MODE_MARGINREQUIRED:
         return(0);
      case MODE_FREEZELEVEL:
         return(SymbolInfoInteger(symbol,SYMBOL_TRADE_FREEZE_LEVEL));

      default: return(0);
     }
   return(0);
  }


double GetAllOpenOrdersProfit(int magicNumber)
{
   double totalProfit = 0;

   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);
      int order_type =  PositionGetInteger(POSITION_TYPE);         
      if (PositionGetInteger(POSITION_MAGIC) != magicNumber || ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;

      if (order_type == POSITION_TYPE_BUY || order_type == POSITION_TYPE_SELL)
      {
        totalProfit += PositionGetDouble(POSITION_PROFIT);
      }
   }

   return totalProfit;


}

void closeAllOpenOrders(int magic)
{
   string caller = "";
   int total, cnt;
   color clr;
   int order_type;

   //Print("closeOpenOrders(" + type + "," + magic + ") " + caller);

   while (getNumOpenOrders(magic) > 0)
   {
      // while (IsTradeContextBusy())
      // {
      //    Print("closeOpenOrders(): waiting for trade context.");
      //    Sleep(MathRand() / 10);
      // }
      total = OrdersTotal();
      //RefreshRates();

      for (int trade = 0 ; trade < OrdersTotal(); trade++)
      {
         ulong ticket = OrderGetTicket(trade);

         int order_type = OrderGetInteger(ORDER_TYPE); 
         
         // magic number is coming as zero need to fix that. 
         //if (OrderGetInteger(ORDER_MAGIC) != magic || order_type != type)
         if (OrderGetInteger(ORDER_MAGIC) != magic || ticket <= 0 || OrderGetString(ORDER_SYMBOL) != _Symbol)
            continue;         

         if (order_type == ORDER_TYPE_BUY_STOP || 
               order_type == ORDER_TYPE_SELL_STOP || 
               order_type == ORDER_TYPE_BUY_STOP_LIMIT || 
               order_type == ORDER_TYPE_SELL_STOP_LIMIT || 
               order_type == ORDER_TYPE_BUY_LIMIT || 
               order_type == ORDER_TYPE_SELL_LIMIT)
         {
            orderDeleteReliable(ticket);
         }            
            
      }

      for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
      {
         ulong ticket = PositionGetTicket(trade);
         int order_type =  PositionGetInteger(POSITION_TYPE);         
         // magic number is coming as zero need to fix that. 
         //if (PositionGetInteger(POSITION_MAGIC) != magic || order_type != type)
         if (PositionGetInteger(POSITION_MAGIC) != magic || ticket <= 0 || PositionGetString(POSITION_SYMBOL) != _Symbol)
            continue;

         if (order_type == POSITION_TYPE_BUY || order_type == POSITION_TYPE_SELL)
         {
            int result = orderCloseReliable(ticket, PositionGetDouble(POSITION_VOLUME), 0, 999, clr);

            if (result > 0)
            {
               Print("Error happened in orderCloseReliable with code: ", result);
               return;
            }
         }      
      }      
   }
}

double RoundNumber(double number, int digits) 
{  
   number = MathRound(number * MathPow(10, digits));  
   return (number * MathPow(10, -digits)); 
}

/**
* Drop-in replacement for OrderModify().
* Try to handle all errors and locks and return only if successful
* or if the error can not be handled or waited for.
*/
bool orderModifyReliable(
    int ticket,
    double price,
    double stoploss,
    double takeprofit,
    datetime expiration,
    color arrow_color = CLR_NONE)
{
   bool success;
   int err;
   //Print("OrderModifyReliable(" + ticket + "," + price + "," + stoploss + "," + takeprofit + "," + expiration + "," + arrow_color + ")");
   while (true)
   {
      // while (IsTradeContextBusy())
      // {
      //    Print("OrderModifyReliable(): Waiting for trade context.");
      //    Sleep(MathRand() / 10);
      // }
      success = trade.OrderModify(
          ticket,
          NormalizeDouble(price, Digits()),
          NormalizeDouble(stoploss, Digits()),
          NormalizeDouble(takeprofit, Digits()),
          ORDER_TIME_GTC,
          expiration);

      if (success)
      {
         //Print("OrderModifyReliable(): Success!");
         return (true);
      }

      err = GetLastError();
      if (isTemporaryError(err))
      {
         Print("orderModifyReliable(): Temporary Error: " + err + " " + "ErrorDescription(err)" + ". waiting.");
      }
      else
      {
         Print("orderModifyReliable(): Permanent Error: " + err + " " + "ErrorDescription(err)" + ". giving up.");
         return (false);
      }
      Sleep(MathRand() / 10);
   }
}

bool IsTradableNow(const string symbol)
{
   datetime from = 0;
   datetime to   = 0;
   datetime current_time = TimeTradeServer();

   int day = TimeDayOfWeek(current_time);
   int sessions = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_SESSIONS);

   for(int i = 0; i < sessions; i++)
   {
      if(SymbolInfoSessionTrade(symbol, day, i, from, to))
      {
         if(current_time >= from && current_time <= to)
            return true;
      }
   }
   return false;
}






// Checks if market is currently open for specified symbol
bool IsMarketOpen(const string symbol, const bool debug = false)
{
    datetime from = NULL;
    datetime to = NULL;
    datetime serverTime = TimeTradeServer();
    int HR2400 = (24 * 60);

    // Get the day of the week
    MqlDateTime dt;
    TimeToStruct(serverTime,dt);
    const ENUM_DAY_OF_WEEK day_of_week = (ENUM_DAY_OF_WEEK) dt.day_of_week;



    // Get the time component of the current datetime
    const int time = (int) MathMod(serverTime,HR2400);

    if ( debug && weekDay != EnumToString(day_of_week)) PrintFormat("%s(%s): Checking1 %s", __FUNCTION__, symbol, EnumToString(day_of_week));

    // Brokers split some symbols between multiple sessions.
    // One broker splits forex between two sessions (Tues thru Thurs on different session).
    // 2 sessions (0,1,2) should cover most cases.
    int session=2;
    MqlDateTime from_struct, to_struct;
    while(session > -1)
    {
        if(SymbolInfoSessionTrade(symbol,day_of_week,session,from,to ))
        {
            bool convertedFrom = TimeToStruct(from, from_struct);
            bool convertedTo = TimeToStruct(to, to_struct);

            // Print("from ", from, " to ", to, " from_struct.hour ", from_struct.hour, " from_struct.min ", from_struct.min, " dt.min " , dt.min
            // , " to_struct.hour ", to_struct.hour, " to_struct.min ", to_struct.min);

            if (convertedFrom && convertedTo &&
                 (dt.hour >= from_struct.hour && dt.min > from_struct.min) &&
                 (dt.hour <= to_struct.hour && dt.min < to_struct.min))
            {
               if ( debug && weekDay != EnumToString(day_of_week)) {
                  PrintFormat("%s Market is open", __FUNCTION__);
                  Print(" day_of_week ", day_of_week, " serverTime ", serverTime, " from ", from , " to ", to);
                }
                 weekDay = EnumToString(day_of_week);
                 
                return true;

            }

            if ( debug && weekDay != EnumToString(day_of_week)) {
                     Print(" day_of_week ", day_of_week, " serverTime ", serverTime, " from ", from , " to ", to);
            }

            if ( debug && weekDay != EnumToString(day_of_week)) PrintFormat(    "%s(%s): Checking %d>=%d && %d<=%d",
                                        __FUNCTION__,
                                        symbol,
                                        time,
                                        from,
                                        time,
                                        (to - (60 * 30)) );
            // if(time >=from && time <= (to - (60 * 30)) )
            // {
            //     if ( debug && weekDay != EnumToString(day_of_week)) {
            //       PrintFormat("%s Market is open", __FUNCTION__);
            //       Print(" day_of_week ", day_of_week, " serverTime ", serverTime, " from ", from , " to ", to);
            //     }
            //      weekDay = EnumToString(day_of_week);
                 
            //     return true;
            // }
        }
        session--;
    }
    if ( debug && weekDay != EnumToString(day_of_week)) PrintFormat("%s Market not open", __FUNCTION__);

    weekDay = EnumToString(day_of_week);   

    return false;
}


int orderCloseReliable(
    int ticket,
    double lots,
    double price,
    int slippage,
    color arrow_color = CLR_NONE)
{
   bool success;
   int err;
   //Print("orderCloseReliable()");
   while (true)
   {
      if (IsStopped())
      {
         Print("orderCloseReliable(): Trading is stopped!");
         return err;
      }
      
      // if (!IsTradeContextBusy())
      // {
         success = trade.PositionClose(ticket);

         if (success)
         {
            //Print("orderCloseReliable(): Success!");
            return 0; // the normal exit
         }

         err = GetLastError();
         if (isTemporaryError(err))
         {
            Print("orderCloseReliable(): Temporary Error: " + err + " " + "ErrorDescription(err)" + ". waiting.");
         }
         else
         {
            datetime serverTime = TimeTradeServer();        
            const int time = (int) MathMod(serverTime, (60 * 24));
            MqlDateTime dt;
            TimeToStruct(serverTime,dt);
            Print("orderCloseReliable(): Permanent Error: " + err + " " + "ErrorDescription(err)" + ". giving up time " , time, " ",  serverTime);  
            printf("%02d.%02d.%4d, day of year = %d",dt.day,dt.mon, 
          dt.year,dt.day_of_year);
            return err;
         }
      // }
      // else
      // {
      //    Print("orderCloseReliable(): Must wait for trade context");
      // }
      Sleep(MathRand() / 10);
   }
}

ulong GetOpenOrderPosition(int magicNumber)
{
   for (int trade = PositionsTotal() - 1; trade >= 0; trade--)
   {
      ulong ticket = PositionGetTicket(trade);

      if (ticket > 0) 
      {
         if (PositionGetInteger(POSITION_MAGIC) != magicNumber || PositionGetString(POSITION_SYMBOL) != _Symbol)
            continue;         

         return ticket;
      }
   }   
   
   return 0;   
}

bool ObjectCreateMQL4(string name,
                      ENUM_OBJECT type,
                      int window,
                      datetime time1,
                      double price1,
                      datetime time2=0,
                      double price2=0,
                      datetime time3=0,
                      double price3=0)
  {
   return(ObjectCreate(0,name,type,window,
          time1,price1,time2,price2,time3,price3));
  }

bool orderDeleteReliable(int ticket)
{
   bool success;
   int err;
   //Print("orderDeleteReliable(" + ticket + ")");
   while (true)
   {
      // while (IsTradeContextBusy())
      // {
      //    Print("OrderDeleteReliable(): Waiting for trade context.");
      //    Sleep(MathRand() / 10);
      // }

      success = trade.OrderDelete(ticket);

      if (success)
      {
         //Print("orderDeleteReliable(): success.");
         return (true);
      }

      err = GetLastError();
      if (isTemporaryError(err))
      {
         Print("orderDeleteReliable(): Temporary Error: " + err + " " + "ErrorDescription(err)" + ". waiting.");
      }
      else
      {
         Print("orderDeleteReliable(): Permanent Error: " + err + " " + "ErrorDescription(err)" + ". giving up.");
         return (false);
      }
      Sleep(MathRand() / 10);
   }
}

double ND(double val)
{
   return (NormalizeDouble(val, Digits()));
}

bool isMartingaleLimitsAllowed(double StartLotSize, double previousOrderSize, double martingaleLotMultiplier, int maxTimesMartingaleAllowed, double maxMartingaleLotSize)
{
   if (previousOrderSize == StartLotSize)
   {
      return true;
   }

   if ((previousOrderSize * martingaleLotMultiplier) > maxMartingaleLotSize)
   {
      return false;
   }

   double lot = StartLotSize;
   int count = 0;

   while (lot <= previousOrderSize)
   {
      count++;
      lot = lot * martingaleLotMultiplier;
   }

   if (count > maxTimesMartingaleAllowed)
   {
      return false;
   }

   return true;
}

void setDSTTime(datetime &dstTime, ENUM_MARKET_SESSIONS session)
{
   MqlDateTime localTime; 
   TimeGMT(localTime);
   int year = localTime.year;
   datetime dt1, dt2, dst_start, dst_end;
   MqlDateTime st1, st2;

   if (session == SESSION_US_FOREX || session == SESSION_US_STOCK)
   {
      /* US DST begins at 02:00 local time on the second Sunday of March
      and ends at 02:00 local time on the first Sunday of November */
      dt1 = StringToTime((string)year + ".03.14 02:00");
      dt2 = StringToTime((string)year + ".11.07 02:00");
   }
   else if (session == SESSION_EUROPE)
   {
      /* UK DST begins at 01:00 local time on the last Sunday of March
      and ends at 02:00 local time on the last Sunday of October */
      dt1 = StringToTime((string)year+".03.31 01:00");
      dt2 = StringToTime((string)year+".10.31 02:00");
   }
   else
   {
      return;
   } 
   
   TimeToStruct(dt1, st1);
   TimeToStruct(dt2, st2);
   dst_start = dt1 - (st1.day_of_week * 86400);
   dst_end  = dt2 - (st2.day_of_week * 86400);

   if(dstTime > dst_start && dstTime < dst_end)
   {
      dstTime -= 3600;
   }
}

ulong GetLastDeal(ENUM_DEAL_TYPE positionType, int magicNumber)
{
   HistorySelect(TimeCurrent() - PeriodSeconds(PERIOD_MN1), TimeCurrent() + 10);
   uint total = HistoryDealsTotal();
   ulong dealticket = 0;
   string dealsymbol;
   double dealvolume=0;
   double dealTP=0;
   int dealMagic;
   int dealtype;

   for (int i = total-1; i >=0 ; i--)
   {
      dealticket = HistoryDealGetTicket(i);

      if(dealticket <= 0)
      {
         continue;
      }

      dealsymbol = HistoryDealGetString(dealticket,DEAL_SYMBOL);
      dealMagic =  HistoryDealGetInteger(dealticket,DEAL_MAGIC);
      dealtype =  HistoryDealGetInteger(dealticket,DEAL_TYPE);

      if(dealsymbol != Symbol() || dealMagic != magicNumber || dealtype != positionType)
      {
         continue;
      }

      return dealticket;      
   }

   return 0;
}


bool isTemporaryError(int error)
{
   return (
       error == ERR_NO_ERROR ||
       error == ERR_COMMON_ERROR ||
       error == ERR_SERVER_BUSY ||
       error == ERR_NO_CONNECTION ||
      // error == ERR_MARKET_CLOSED ||
       error == ERR_PRICE_CHANGED ||
       error == ERR_INVALID_PRICE || //happens sometimes
       error == ERR_OFF_QUOTES ||
       error == ERR_BROKER_BUSY ||
       error == ERR_REQUOTE ||
       error == ERR_TRADE_TIMEOUT ||
       error == ERR_TRADE_CONTEXT_BUSY);
}

void DrawObject(datetime timeToMark, double valueToMark, ENUM_OBJECT objectType, color colorValue, int objectWidth)
{
   string objName = "PeakAway" + timeToMark;
   ObjectCreateMQL4(objName, objectType, 0, timeToMark, valueToMark);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, colorValue); 
   ObjectSetInteger(0, objName, OBJPROP_WIDTH, objectWidth);    
}

void DrawVerticalLine(datetime timeToMark, color colorValue)
{
   string objName = "verticalLine" + timeToMark + colorValue;
   ObjectCreate(0, objName, OBJ_VLINE, 0, timeToMark, 0);   
   ObjectSetInteger(0, objName, OBJPROP_COLOR, colorValue);   
   ObjectSetInteger(0, objName, OBJPROP_WIDTH, 2); 
   ObjectSetInteger(0,objName, OBJPROP_STYLE, STYLE_SOLID);    
}