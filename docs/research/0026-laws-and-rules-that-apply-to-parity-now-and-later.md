---
id: RES-0026
title: Laws and rules that apply to Parity now and later
type: research
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [crypto, process]
related: [DEC-0019, DEC-0022, DEC-0032, DEC-0046, REF-0020]
---

# Laws and rules that apply to Parity now and later

## In plain words

The owner asked which laws Parity actually has to follow, so that a user with a problem can be pointed to the rule. Today Parity is a free research and teaching site with pretend trading, so most money laws do not bite yet. The rules that matter now are about honest claims, privacy, accessibility, children and the data licences we use. Selling plans, giving advice tailored to one person, or letting people trade real money each switches on a new set of rules, and some of them need a licence before we start. This is a summary for planning, read from the laws themselves on 25 October 2026. It is not legal advice, and a lawyer has to check it.

## Summary

- **Today Parity relies on not doing the regulated thing.** It gives no advice tailored to a person, takes no pay tied to trades, holds no money and opens no accounts. Each exclusion below depends on that staying true.
- **The five rules that matter most now:**
  1. The Investment Advisers Act's publisher exclusion, as read by the Supreme Court in *Lowe v. SEC* (1985). Content must stay impersonal, disinterested and regularly published.
  2. The Commodity Exchange Act's definition of a commodity trading advisor (CTA), with the publisher exclusion and the CFTC's exemption for advice that is not tailored and does not direct accounts (17 CFR 4.14(a)(9)). Signals on futures, perps and forex fall under the CEA, not the securities laws.
  3. FTC Act Section 5 on deceptive claims, with the Endorsement Guides and the 2024 rule on reviews and testimonials. This covers what Verify badges and performance numbers say.
  4. Privacy law: the GDPR and UK GDPR if we serve people there, California's CCPA and the other state laws as we grow, and Delaware's rule that a site must post a privacy policy.
  5. The data licences of the sources we show (REF-0014, REF-0010), and the ADA and WCAG for accessibility.
- **What would trigger registration:** advice tailored to a person's holdings or situation, signals that direct or auto-trade accounts, pay that depends on trades, opening accounts or handling orders for a broker, touching customer money or crypto, or soliciting US customers for an unregistered offshore venue.
- **What is unclear and needs counsel:** whether the Verify Score and the Seller tier keep us inside the publisher exclusion; whether the GDPR applies to us today and whether we need an EU or UK representative; whether the AI connector could make our tools give tailored advice; and how the EU and UK treat signals shown to people there.

## What Parity does today

Facts from the decision records, as of 25 October 2026.

| Feature | What it does | Money involved |
| --- | --- | --- |
| Research and Academy | Backtests, tests passed and failed, short courses | None, free |
| Strategy results and signals on charts | The same view for every visitor, on delayed or daily data | None |
| Verify ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)) | Checks a trade log in the browser; optional public badge; optional anonymised dataset row that may be sold in aggregate | None today; paid tiers proposed in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) |
| Demo accounts and Parity Trade ([DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)) | Pretend orders against delayed prices in the browser | None |
| News | A news archive and impact ranking ([DEC-0026](../decisions/0026-a-news-archive-and-an-impact-engine-that-ranks-by-evidence.md)) | None |
| AI connector ([DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)) | People's own AI calls Parity's tools | None to us |
| Payments | Stripe code in test mode behind a flag that is off ([DEC-0046](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)) | None |
| Real trading | Not built. Only through a regulated broker partner, never holding funds ([DEC-0019](../decisions/0019-real-trading-later-what-it-would-legally-take.md), DEC-0046) | None |

Accounts are for people 18 and over. The company is Parity Trading, Inc., a Delaware corporation.

## US securities law

### Investment Advisers Act of 1940

**The rule.** An investment adviser is anyone who, "for compensation, engages in the business of advising others, either directly or through publications or writings, as to the value of securities or as to the advisability of investing in, purchasing, or selling securities" ([15 U.S.C. 80b-2(a)(11)](https://www.law.cornell.edu/uscode/text/15/80b-2)). The SEC reads the three parts (advice about securities, in the business, for compensation) broadly, and counts any economic benefit as compensation, not only a fee from the client ([SEC Release IA-1092](https://www.sec.gov/rules/interp/1987/ia-1092.pdf)).

**The exclusion we rely on.** Paragraph (D) excludes "the publisher of any bona fide newspaper, news magazine or business or financial publication of general and regular circulation". In *Lowe v. SEC*, 472 U.S. 181 (1985) ([opinion](https://www.law.cornell.edu/supremecourt/text/472/181)), the Supreme Court held that a newsletter qualifies when it is:

1. **impersonal**: it does not give advice attuned to any one client's portfolio or needs;
2. **bona fide**: genuine, disinterested commentary, not promotional material or touting;
3. **of general and regular circulation**: published on a regular schedule, not timed to specific market moves, which the Court contrasted with "hit and run tipsters".

**Now.** Parity's pages are the same for everyone, published continuously, and say "never buy". Parity is also free, which weakens the compensation element, although the SEC counts indirect benefit and the dataset may be sold. The exclusion fits the current product, but it is a judgement, not a registration or a safe harbour.

**What would make Parity an adviser.**

- Advice tailored to a person: "given your demo portfolio, sell X", a strategy picked for a user's goals, or an AI tool that reads a user's holdings and recommends securities trades.
- Signals sent to subscribers and timed to market moves, especially paid alerts.
- Payment from the people whose strategies or products we rate, which undermines "disinterested". The Seller tier in DEC-0032 needs a lawyer's view on this. DEC-0032 already flags the Verify Score.
- Managing money or auto-trading for users.

**If we ever became an adviser.** With no assets under management, an adviser generally registers with the states, not the SEC ([15 U.S.C. 80b-3a](https://www.law.cornell.edu/uscode/text/15/80b-3a)). The internet adviser exemption lets an adviser register with the SEC only if it gives advice to all clients exclusively through an interactive website using software-based models on personal information each client supplies ([17 CFR 275.203A-2(e)](https://www.law.cornell.edu/cfr/text/17/275.203A-2), amended in 2024). States may not require registration from an adviser with no place of business in the state and fewer than 6 clients resident there in the last 12 months ([15 U.S.C. 80b-18a(d)](https://www.law.cornell.edu/uscode/text/15/80b-18a)). The antifraud section applies to every adviser, registered or not ([15 U.S.C. 80b-6](https://www.law.cornell.edu/uscode/text/15/80b-6)).

**State adviser law.** Most states copy the federal definition and the publisher exclusion. Each state's securities regulator enforces it; NASAA lists them ([NASAA](https://www.nasaa.org/contact-your-regulator/)). Whether each state's wording matches the federal one was not checked state by state.

### SEC Marketing Rule

[17 CFR 275.206(4)-1](https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-1) governs advertisements by registered advisers, including testimonials, endorsements, third-party ratings and hypothetical performance. **Now:** it does not apply to Parity, because Parity is not an adviser. **Later:** it applies to any adviser that puts a Parity badge or score in its marketing (as a third-party rating or hypothetical performance), and to Parity if it becomes an adviser. If an adviser pays Parity to refer clients, Parity would be a "promoter" under the rule and the adviser takes on duties. Our terms should say that a badge does not satisfy the rule for anyone who uses it (DEC-0032 already says this).

### Paid touting

Section 17(b) of the Securities Act requires anyone paid by an issuer, underwriter or dealer to describe a security to disclose the payment and its amount ([15 U.S.C. 77q](https://www.law.cornell.edu/uscode/text/15/77q)). **Now:** not triggered. **Later:** any sponsored content, paid listings or partner deals that describe a security or a token that is a security.

### Broker-dealers and finders

A broker is anyone "engaged in the business of effecting transactions in securities for the account of others" ([15 U.S.C. 78c(a)(4)](https://www.law.cornell.edu/uscode/text/15/78c)), and must register under Section 15(a) ([15 U.S.C. 78o](https://www.law.cornell.edu/uscode/text/15/78o)). The SEC's guide lists the signs: pay tied to transactions, soliciting investors, handling customer funds or securities, and taking part in negotiations ([SEC guide to broker-dealer registration](https://www.sec.gov/about/divisions-offices/division-trading-markets/division-trading-markets-compliance-guides/guide-broker-dealer-registration)). There is no general "finder" exemption. The SEC proposed one in 2020 and did not adopt it ([proposed exemptive order, Release 34-90112](https://www.sec.gov/files/rules/exorders/2020/34-90112.pdf)).

**Now:** not triggered. Demo trading uses pretend money. **Later (DEC-0046):** with a broker partner, our pay must not depend on trades or assets, and we must not open accounts, take orders or touch money for the partner. A registered broker may not pay transaction-based compensation to someone who is not registered ([FINRA Rule 2040](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2040)), so the partner contract itself will show where the line is.

### FINRA rules, if partnered with a broker

FINRA rules bind member firms, not Parity, but a partner will pass them down by contract. [FINRA Rule 2210](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210) requires communications to be fair and balanced and generally bars projections of performance in retail communications. [FINRA Rule 2214](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2214) sets the conditions for "investment analysis tools", which is how a broker would have to treat our backtests and simulations if it showed them. People can check any broker or broker staff on [FINRA BrokerCheck](https://brokercheck.finra.org/).

## US commodities and forex law

### Commodity trading advisors

**The rule.** A CTA is anyone who, for compensation or profit, advises others on the value or advisability of trading futures, options on futures, swaps, retail forex and some other commodity contracts ([7 U.S.C. 1a(12)](https://www.law.cornell.edu/uscode/text/7/1a)). Crypto perps, futures and forex signals sit here, not under the securities laws.

**Exclusions and exemptions.**

- The definition excludes "the publisher or producer of any print or electronic data of general and regular dissemination", and also teachers and news reporters, but only where the advice "is solely incidental to the conduct of their business or profession" (7 U.S.C. 1a(12)(B) and (C)).
- A CTA need not register if, in the last 12 months, it advised 15 or fewer persons and does not hold itself out generally to the public as a CTA ([7 U.S.C. 6m(1)](https://www.law.cornell.edu/uscode/text/7/6m); 17 CFR 4.14(a)(10)).
- **The one that fits Parity:** a CTA need not register if it does not direct client accounts and does not give advice "based on, or tailored to, the commodity interest or cash market positions or other circumstances or characteristics of particular clients" ([17 CFR 4.14(a)(9)](https://www.law.cornell.edu/cfr/text/17/4.14)). The CFTC adopted this after a court held that publishers of impersonal trading advice could not be forced to register (*Taucher v. Born*, 53 F. Supp. 2d 464 (D.D.C. 1999)).
- The antifraud section for CTAs applies whether or not they are registered ([7 U.S.C. 6o](https://www.law.cornell.edu/uscode/text/7/6o)).

**Now:** Parity's signals are impersonal and direct no accounts, so 4.14(a)(9) fits. **Watch:** software that turns signals into automatic trades in a user's account. In *CFTC v. Vartuli*, 228 F.3d 94 (2d Cir. 2000), trading software whose signals were meant to be followed mechanically was treated as CTA advice. The CFTC has also warned the public about AI trading bots ([CFTC advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)). Auto-trading, copy trading or bots connected to accounts would need CTA registration and NFA membership unless counsel finds an exemption.

**Promotional material.** Registered firms that are NFA members follow [NFA Rule 2-29](https://www.nfa.futures.org/rulebook/rules.aspx?RuleID=RULE%202-29&Section=4), which requires the hypothetical performance warning. It does not bind Parity today, but our wording on backtests already follows its spirit.

### Retail forex

For retail forex, the CFTC's Part 5 rules require registration as a CTA from anyone who "exercises discretionary trading authority or obtains written authorization to exercise discretionary trading authority" over a retail customer's forex account ([17 CFR 5.1(e)(1)](https://www.law.cornell.edu/cfr/text/17/5.1), [17 CFR 5.3(a)(3)](https://www.law.cornell.edu/cfr/text/17/5.3)). Advice on retail forex is still CTA advice under 7 U.S.C. 1a(12), so the general CTA analysis above applies too. Soliciting or accepting forex or futures orders needs NFA introducing broker registration ([NFA introducing brokers](https://www.nfa.futures.org/registration-membership/who-has-to-register/ib.html)), and being the counterparty needs retail forex dealer status ([NFA RFED](https://www.nfa.futures.org/registration-membership/who-has-to-register/rfed.html)). **Now:** none applies. **Later:** an OANDA-style integration paid per trade would need IB registration (DEC-0046).

## US consumer protection

### FTC Act Section 5

Section 5 bans "unfair or deceptive acts or practices in or affecting commerce" ([15 U.S.C. 45](https://www.law.cornell.edu/uscode/text/15/45)). It applies to Parity now, free or not. For us it means:

- Performance numbers must be backed by evidence and labelled as hypothetical when they are backtests.
- A Verify badge must not imply more than it checks. "Self-reported" must say so, and "verified" must not read as "endorsed" or "will make money".
- The anonymised dataset claim ("no row can be linked back to you") must be true in practice.

### Endorsements, reviews and testimonials

The FTC's Endorsement Guides ([16 CFR Part 255](https://www.law.cornell.edu/cfr/text/16/part-255)) require that an endorsement reflect the endorser's honest experience, that material connections be disclosed, and that an ad with untypical results say what people can generally expect ([FTC FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides)). The 2024 rule on consumer reviews and testimonials ([16 CFR Part 465](https://www.law.cornell.edu/cfr/text/16/part-465)) bans fake testimonials and misrepresenting that a review site is independent when the business controls it.

**Now:** Parity uses no testimonials. Badges are statements by Parity about a record, published at the record owner's request. **Later:** sellers will put badges in their ads, and they bear the FTC duties for their ads, but we should not let badge wording help them mislead. If sellers pay us (the Seller tier) and we present the badge as neutral, the payment is a material connection that needs a lawyer's view under Part 465.

### Subscriptions

When paid tiers turn on, the Restore Online Shoppers' Confidence Act requires clear terms, express consent before charging and a simple way to cancel for online subscriptions ([15 U.S.C. 8403](https://www.law.cornell.edu/uscode/text/15/8403)). California's automatic renewal law adds its own consent, reminder and online cancellation rules ([Cal. Bus. and Prof. Code 17600 and following](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=7.&title=&part=3.&chapter=1.&article=9.)).

### Email

CAN-SPAM ([15 U.S.C. chapter 103](https://www.law.cornell.edu/uscode/text/15/chapter-103), [16 CFR Part 316](https://www.law.cornell.edu/cfr/text/16/part-316)) covers commercial email: honest headers and subject lines, a postal address, and an opt-out honoured within 10 business days. Sign-in and account emails are transactional and mostly exempt ([FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)). **Now:** only transactional email. **Later:** any newsletter or marketing email needs the address (still a TODO on our legal pages) and an unsubscribe link.

### Children

COPPA ([15 U.S.C. chapter 91](https://www.law.cornell.edu/uscode/text/15/chapter-91), [16 CFR Part 312](https://www.law.cornell.edu/cfr/text/16/part-312), amended in 2025) applies to sites directed to children under 13 or with actual knowledge that they collect a child's data. Parity is for adults and the terms require age 18. **Now:** applies only if we learn a child signed up, in which case we delete the data. Academy content must not be aimed at children.

## Accessibility

Title III of the ADA bars discrimination by places of public accommodation ([42 U.S.C. 12182](https://www.law.cornell.edu/uscode/text/42/12182)). The Department of Justice says the ADA applies to websites of businesses open to the public and points to WCAG as a helpful guide ([DOJ web guidance](https://www.ada.gov/resources/web-guidance/)). Courts disagree on whether a business with no physical place is covered. There is no Title III web regulation yet. Our target is [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, as the accessibility statement says. In the EU, the European Accessibility Act ([Directive 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj)) has applied since 28 June 2025 to some consumer services, but microenterprises providing services are exempt; whether Parity's services are in its scope at all needs counsel. People can complain about the ADA to the DOJ ([ADA complaint](https://www.ada.gov/file-a-complaint/)).

## Financial privacy, money and crypto licences

### Gramm-Leach-Bliley Act

GLBA and the FTC's Safeguards Rule ([15 U.S.C. 6809](https://www.law.cornell.edu/uscode/text/15/6809), [16 CFR Part 314](https://www.law.cornell.edu/cfr/text/16/part-314)) apply to "financial institutions", meaning firms significantly engaged in financial activities, which include financial and investment advisory services ([16 CFR 314.2](https://www.law.cornell.edu/cfr/text/16/314.2)). **Now:** probably not. Parity offers no financial product to consumers, and Verify files stay in the browser. **Unsure:** whether a free research site counts as offering "advisory services" for this purpose; a lawyer should say. **Later:** likely applies if we become an adviser, or if we hold brokerage account data from a partner. The Safeguards Rule then needs a written security programme.

### Bank Secrecy Act and anti-money-laundering rules

The BSA's AML duties fall on "financial institutions" such as brokers, money services businesses and others listed in [31 U.S.C. 5312](https://www.law.cornell.edu/uscode/text/31/5312) and [31 CFR 1010.100](https://www.law.cornell.edu/cfr/text/31/1010.100). **Now:** not triggered; no money moves. **Later:** a broker partner runs customer identification ([31 CFR 1023.220](https://www.law.cornell.edu/cfr/text/31/1023.220)) and beneficial ownership checks ([31 CFR 1010.230](https://www.law.cornell.edu/cfr/text/31/1010.230)); we would pass data to it and must protect it. FinCEN's 2024 rule extending AML duties to SEC-registered and exempt reporting advisers has had its start date reviewed and postponed; we did not confirm the current date, and it would not cover a state-registered adviser.

### Money transmission and crypto custody

Taking in and passing on money or crypto for others makes a business a money transmitter under FinCEN's rules ([FinCEN MSB definition](https://www.fincen.gov/money-services-business-definition), [FinCEN 2019 guidance on crypto business models](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models)) and usually needs a licence in each state, plus a BitLicense in New York for crypto ([NYDFS](https://www.dfs.ny.gov/virtual_currency_businesses)). **Now and later:** not applicable while Parity never holds funds or coins, which is the rule in DEC-0046.

## State privacy law

| Law | Who it covers | Parity now | Later |
| --- | --- | --- | --- |
| California CCPA as amended by the CPRA ([Cal. Civ. Code 1798.100 and following](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5)) | For-profit businesses with over $26,625,000 annual gross revenue (2025 figure, [CPPA](https://cppa.ca.gov/regulations/cpi_adjustment.html)), or that buy, sell or share data of 100,000 or more consumers or households, or earn half their revenue from selling or sharing data ([1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140)) | Probably below every threshold. The privacy policy already honours the rights | Applies once a threshold is passed. Selling the dataset is fine only if the rows meet the law's deidentification test: reasonable measures, a public commitment not to reidentify, and contracts binding buyers |
| Virginia Consumer Data Protection Act ([Va. Code 59.1-575 and following](https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/)) | 100,000 consumers a year, or 25,000 and over half of revenue from selling data | Below | Watch user counts |
| Colorado Privacy Act ([Colorado AG](https://coag.gov/resources/colorado-privacy-act/)) | 100,000 consumers a year, or 25,000 and any revenue from selling data | Below | Selling the dataset could lower the bar if rows are personal data |
| Texas Data Privacy and Security Act ([Tex. Bus. and Com. Code ch. 541](https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm)) | Anyone doing business in Texas who is not a small business by the US SBA's test; small businesses still need consent to sell sensitive data | Probably a small business | Check when revenue or staff grow |
| Delaware Personal Data Privacy Act ([6 Del. C. ch. 12D](https://delcode.delaware.gov/title6/c012d/index.html)) | 35,000 consumers, or 10,000 and over 20% of revenue from selling data; from 1 January 2027, 10,000 consumers, or 5,000 and over 20% | Below | Lower bar from 2027 |
| Delaware Online Privacy and Protection Act ([6 Del. C. ch. 12C](https://delcode.delaware.gov/title6/c012c/index.html)) | Any commercial site that collects personal data from Delaware residents must post a privacy policy | **Applies now.** Met by our privacy policy | Keep it current |

Thresholds for Virginia, Colorado and Texas are from our reading of the statutes and were not checked against each state's latest amendments. More states have similar laws; most use thresholds of the same kind.

**Data brokers.** California's Delete Act requires registration of businesses that sell data about consumers they have no direct relationship with. Our dataset comes from our own users and is meant to be anonymous, so it likely does not apply. A lawyer should confirm before any sale.

## Delaware corporate basics

Parity Trading, Inc. is a Delaware corporation. Delaware requires a registered agent with an address in the state ([8 Del. C. 132](https://delcode.delaware.gov/title8/c001/sc01/index.html)) and an annual franchise tax report and payment, due 1 March for corporations ([Delaware Division of Corporations](https://corp.delaware.gov/paytaxes/)). If the company operates from another state, it may need to register there as a foreign corporation. Which state that is was not in the records we read.

## International

### GDPR and UK GDPR

The GDPR ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)) applies to a company outside the EU when it offers goods or services to people in the EU or monitors their behaviour there (Article 3(2)). The UK GDPR and the Data Protection Act 2018 do the same for the UK ([UK GDPR](https://www.legislation.gov.uk/eur/2016/679/contents), [DPA 2018](https://www.legislation.gov.uk/ukpga/2018/12/contents)).

- **Now:** Parity is in English with US dollar prices and has no tracking, so whether it "offers" services to the EU is a judgement. The privacy policy already treats the GDPR as applying, which is the safer reading.
- **Rights:** access, correction, deletion, restriction, objection, portability and withdrawal of consent (Articles 15 to 22), answered within one month (Article 12(3)), and the right to complain to a supervisory authority (Article 77). Authorities are listed by the [EDPB](https://www.edpb.europa.eu/about-edpb/about-edpb/members_en) and the UK's is the [ICO](https://ico.org.uk/make-a-complaint/).
- **Representative:** a controller outside the EU that is caught by Article 3(2) must name a representative in the EU (Article 27), unless its processing is occasional and low risk. The UK GDPR has the same rule. Whether we need one is an open question for counsel.
- **The dataset:** anonymous data falls outside the GDPR (Recital 26), but making it is processing, which is why the opt-in box exists.

### Cookie consent

The ePrivacy Directive ([2002/58/EC](https://eur-lex.europa.eu/eli/dir/2002/58/oj), Article 5(3)) and the UK's PECR ([regulation 6](https://www.legislation.gov.uk/uksi/2003/2426/regulation/6)) require consent before storing or reading anything on a device, except what is strictly necessary for a service the user asked for. **Now:** we store only essential items, as the cookie policy says. **Later:** analytics needs opt-in consent first (work in progress on a separate branch).

### EU investment rules

- **MiFID II** ([Directive 2014/65/EU](https://eur-lex.europa.eu/eli/dir/2014/65/oj)) makes "investment advice", meaning personal recommendations (Article 4(1)(4)), a licensed service. A recommendation issued only to the public is not a personal recommendation ([Delegated Regulation 2017/565, Article 9](https://www.legislation.gov.uk/eur/2017/565/article/9)). **Now:** our public signals are not investment advice under MiFID. **Later:** tailored advice to EU users would need a licence.
- **Market Abuse Regulation** ([Regulation 596/2014](https://eur-lex.europa.eu/eli/reg/2014/596/oj), Article 20, with [Delegated Regulation 2016/958](https://eur-lex.europa.eu/eli/reg_del/2016/958/oj)): anyone who produces or spreads "investment recommendations", which include information suggesting an investment strategy on a financial instrument, must present them objectively and disclose conflicts of interest. **Unsure:** whether strategy signals on EU-traded instruments shown to EU users count. If they do, a short disclosure of who made the signal and our interests would cover it.
- **MiCA** ([Regulation 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj)) makes advice on crypto-assets to EU clients a licensed crypto-asset service. **Now:** we give no personal advice. **Later:** tailored crypto advice to EU users would need a licence.
- **Digital Services Act** ([Regulation 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)): public badge pages are content hosted at a user's request. Hosting services offered in the EU have duties such as points of contact and, for providers outside the EU, a legal representative. **Unsure:** whether serving EU users at our size triggers this; counsel to check.

### UK financial promotions

Section 21 of the Financial Services and Markets Act 2000 bars communicating "an invitation or inducement to engage in investment activity" in the course of business unless an authorised firm makes or approves it ([FSMA s21](https://www.legislation.gov.uk/ukpga/2000/8/section/21)). It reaches communications from abroad that can have an effect in the UK. The Financial Promotion Order ([SI 2005/1529](https://www.legislation.gov.uk/uksi/2005/1529/contents)) exempts communications directed only at people outside the UK. Since October 2023 cryptoassets are covered too. Advice in a publication whose principal purpose is not advice is excluded from the regulated activity of advising ([RAO article 54](https://www.legislation.gov.uk/uksi/2001/544/article/54), [FCA PERG 7](https://www.handbook.fca.org.uk/handbook/PERG/7/), [FCA PERG 8](https://www.handbook.fca.org.uk/handbook/PERG/8/)). **Now:** education and research are generally not promotions. **Unsure:** strategy signals and crypto content shown to UK users. A demo account that links to a real broker could be a promotion. **Later:** before targeting UK users, get UK advice or block the features that could be promotions.

## Market data licences

Every source we show keeps its own terms, which REF-0014 and REF-0010 record source by source ([REF-0014](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md), [REF-0010](../reference/0010-fx-data-sources-licences-and-resolution.md)). In general, exchanges charge and require agreements to display real-time data, and often delayed data too; they treat professional and non-professional users differently, and many free APIs forbid redistribution or commercial use. **Now:** we use delayed, daily and openly licensed data, and REF-0014 lists what was turned down. **Later:** paid tiers turn our use commercial, which some free licences forbid; the API and dataset must not resell any vendor's prices; real-time exchange data needs vendor agreements and user classification before launch.

## Crypto

- **Showing prices and perps data is publishing.** No US licence covers it, subject to each data source's licence.
- **The SEC** has said in staff statements that some crypto assets and activities are not securities, for example meme coins ([SEC staff statement on meme coins](https://www.sec.gov/newsroom/speeches-statements/staff-statement-meme-coins)) and some protocol staking ([SEC statement on protocol staking](https://www.sec.gov/newsroom/speeches-statements/statement-certain-protocol-staking-activities-052925)). It runs a Crypto Task Force on the rest ([SEC Crypto Task Force](https://www.sec.gov/about/crypto-task-force)). Staff statements are not rules and can change.
- **The CFTC** treats bitcoin and ether as commodities (courts agreed in *CFTC v. McDonnell*, E.D.N.Y. 2018). Advice on crypto futures and perps is commodity advice under the CTA rules above. US people may trade perps only on CFTC-registered venues; the CFTC has charged offshore venues that took US customers (for example the charges against Binance, [CFTC press release 8680-23](https://www.cftc.gov/PressRoom/PressReleases/8680-23)).
- **For Parity:** no affiliate or referral links to offshore perp venues for US users, since being paid to bring them customers can be acting as an unregistered introducing broker. No custody, no exchange, no token of our own.
- **Unconfirmed:** Congress has been working on crypto market structure law. We did not confirm its status today.

## What triggers registration

| If Parity starts to | Likely needs | Source |
| --- | --- | --- |
| Give advice about securities tailored to a person, for any economic benefit | State investment adviser registration (or SEC, via the internet adviser exemption) | 15 U.S.C. 80b-2, 80b-3a; 17 CFR 275.203A-2(e) |
| Send paid, market-timed securities alerts, or get paid by the people whose products we rate | Risk of losing the publisher exclusion | *Lowe v. SEC* |
| Give tailored futures, perps or forex advice, or let signals trade accounts automatically | CTA registration and NFA membership | 7 U.S.C. 1a(12), 6m; 17 CFR 4.14, 5.3 |
| Take pay per trade, open accounts or handle orders for a broker | Broker-dealer registration and FINRA membership | 15 U.S.C. 78o; FINRA Rule 2040 |
| Take forex or futures orders, or get paid per trade by an FCM | NFA introducing broker registration | NFA |
| Hold or move customer money or crypto | FinCEN registration, state money transmitter licences, BitLicense | FinCEN, NYDFS |
| Give personal investment or crypto advice to EU users | MiFID II or MiCA authorisation | MiFID II, MiCA |
| Promote investments or crypto to UK users | FCA authorisation or an approver | FSMA s21 |

## Exemptions and exclusions we rely on

1. The Advisers Act publisher exclusion, 15 U.S.C. 80b-2(a)(11)(D), as read in *Lowe v. SEC*.
2. The CEA publisher exclusion, 7 U.S.C. 1a(12)(B), and the CTA exemption for advice that is not tailored and directs no accounts, 17 CFR 4.14(a)(9).
3. No broker activity: no transaction-based pay, no accounts, no orders, no custody (15 U.S.C. 78c(a)(4), 78o).
4. No money transmission: Parity never holds funds or crypto.
5. Privacy thresholds: below the CCPA and other state thresholds today, while honouring the rights anyway.
6. Essential-only storage under ePrivacy and PECR.
7. Public recommendations are not personal recommendations under MiFID II.

## What we could not confirm

- The current start date of FinCEN's AML rule for investment advisers.
- The status of US crypto market structure legislation.
- Whether each state's adviser law copies the federal publisher exclusion word for word.
- The latest thresholds in Virginia, Colorado and Texas after any 2025 or 2026 amendments.
- Whether the Verify Score, the Seller tier and the AI connector stay within the publisher exclusion. This is the biggest open question for counsel.
- The state the company operates from, which decides foreign registration and some state taxes.

## Sources

Primary sources are linked where they are used above. Court cases without links: *Taucher v. Born*, 53 F. Supp. 2d 464 (D.D.C. 1999); *CFTC v. Vartuli*, 228 F.3d 94 (2d Cir. 2000); *CFTC v. McDonnell*, 287 F. Supp. 3d 213 (E.D.N.Y. 2018). Complaint bodies used on the public page: [Investor.gov](https://www.investor.gov/), [SEC tips and complaints](https://www.sec.gov/tcr), [SEC investor complaint form](https://help.sec.gov/s/investor-complaint), [CFTC complaints](https://www.cftc.gov/complaint), [NFA BASIC](https://www.nfa.futures.org/basicnet/), [FINRA complaints](https://www.finra.org/investors/have-problem/file-complaint), [FTC ReportFraud](https://reportfraud.ftc.gov/), [NAAG find my AG](https://www.naag.org/find-my-ag/), [California AG on the CCPA](https://oag.ca.gov/privacy/ccpa), [CPPA complaints](https://cppa.ca.gov/webapplications/complaint), [DOJ civil rights](https://www.civilrights.justice.gov/).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0020: Product analytics events](../reference/0020-product-analytics-events.md)
<!-- backlinks:end -->
