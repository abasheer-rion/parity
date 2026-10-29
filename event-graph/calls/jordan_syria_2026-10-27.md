# Jordan strikes Syria, 2026-10-27: first call made by the bridge

Made at 2026-10-27 10:08 ET by `funnel/bridge.py`, with nothing hand-written. GDELT showed 234 conflict articles a day
for JOR-SYR against a 30-day median of 0, and two outlets confirmed it: Al Jazeera ("Jordan attacks Syria in response
to Karak church attack") and Investing.com ("Jordan says its air force struck 'militant hideouts' in Syria after
church attack"). The 36 calls in `jordan_syria_2026-10-27.csv` come from the conflict channel rules alone.

Pre-registered before any price was seen: these calls are probably several times too big (Brent +10%, VIX +23%).
The conflict priors were tuned on wars that touched oil or a great power (Abqaiq, Soleimani, Ukraine, 10/7,
Iran-Israel) and are scaled 2.59x. A limited strike on militants in Syria is neither. The engine has no conflict
severity yet. Score after the 10-27 and 10-28 closes; expect small moves, and use the gap to propose severity classes.
