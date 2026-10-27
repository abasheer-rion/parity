"""Automatic newsroom posts built from Parity's own data (DEC-0073).

Three jobs, each behind its own switch in content/seo/automation.toml:

    market_week       a weekly comparison of a fixed set of markets, with a chart and a table
    news_commentary   the week's headlines that came on days of unusual market moves
    press_release     what shipped, from the merged feat pull requests on main

    python3 -m scripts.autopost run --jobs market_week,news_commentary,press_release --data <dir>

Every post is checked before it is written: each number in the text must match the data it
came from, each link must be one of the cited sources, the newsroom rules (DEC-0057) must
pass, and the volume caps must allow it. Standard library only.
"""
