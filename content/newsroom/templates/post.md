+++
# A newsroom post (DEC-0057, how-to in GDE-0009). Only status = "published" builds publicly.
title = "{title}"
dek = "One or two sentences under the title that say what the post finds or announces."
slug = "{slug}"
date = {date}
# updated = {date}
type = "{type}"          # Research, Analysis, Opinion, Explainer, News, Company update or Press release
stance = "{stance}"      # Fact-based reporting, Analysis or Opinion. Shown on the page. Opinion posts must say Opinion.
status = "draft"         # draft, then review, then published once a person has read it
authors = ["{author}"]   # ids from content/newsroom/authors.toml
tags = []                # lower case, hyphens: ["backtests", "currencies"]
markets = []             # free text: ["Currencies", "Stocks"]
related = []             # slugs of other published posts
# featured = true        # the big spot at the top of /blog/ or /news/

# A hero image is optional. Pick one kind:
# [hero]
# kind = "chart"                 # drawn from our data, see scripts/newsroom/charts.py
# chart = "catalog-evidence"
# alt = "What the chart shows, with its main numbers."
#
# [hero]
# kind = "stock"                 # Unsplash or Pexels only
# src = "images/{slug}/hero.jpg"
# alt = "What the photo shows."
# credit = "Photographer's name"
# licence = "Unsplash License"   # or "Pexels License"
# source_url = "https://unsplash.com/photos/..."

# Research, Analysis and News posts must list sources. Cite them in the text as [^id].
# [[sources]]
# ref = "mclean2016"             # a key in docs/_system/references.json fills the rest
#
# [[sources]]
# id = "fed-h10"
# title = "Foreign Exchange Rates, H.10"
# url = "https://www.federalreserve.gov/releases/h10/"
# publisher = "Federal Reserve"

# Fixes after publishing go here, newest last. They show at the end of the post.
# [[corrections]]
# date = {date}
# text = "An earlier version said X. It is Y."
+++

Start with what the post found or announces, in one or two sentences.

## A section heading

Keep sentences short. Every number needs a source[^id] or a link to our own data.

> [!pull] A line from the post worth pulling out.
