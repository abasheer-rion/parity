# A moving-average strategy written for backtesting.py, the way its users usually write one.
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from backtesting.test import SMA
import pandas as pd


class TwoAverages(Strategy):
    fast = 15
    slow = 40
    stop = 0.08

    def init(self):
        price = self.data.Close
        self.fast_ma = self.I(SMA, price, self.fast)
        self.slow_ma = self.I(SMA, price, self.slow)

    def next(self):
        if crossover(self.fast_ma, self.slow_ma):
            self.position.close()
            self.buy(sl=self.data.Close[-1] * (1 - self.stop))
        elif crossover(self.slow_ma, self.fast_ma):
            self.position.close()
            self.sell()


data = pd.read_csv("btc_daily.csv", index_col=0, parse_dates=True)
bt = Backtest(data, TwoAverages, cash=25_000, commission=0.001)
print(bt.run())
