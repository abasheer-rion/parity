"""The data registry (DEC-0064): every data source and series, what its terms allow, where it
is used, and its life from candidate to retired.

    parity registry sync        bring the registry in line with the catalog and providers
    parity registry status      counts by status and health, and the newest events
    parity registry sources     every source with its display rights and terms date
    parity registry series      every series, with filters
    parity registry publish     send changes to the site's database (writer URL needed)

The registry is the list of record for data. `parity.data.catalog` stays the hand-written
list of curated series and `parity.data.providers` the list of providers; every sync copies
them into the registry, and series that discovery finds and enrolment accepts live only in
the registry. `catalog.get` falls back to the registry for those, so the store, the panel
and the search read them like any catalog series.

Modules:
    model     the fields and the words allowed in them
    rights    what a series' display rights allow, used wherever data is served
    tags      tags and labels from rules, plus a small local classifier
    seed      the registry rows built from the catalog, the providers and the code
    db        the local working copy (SQLite) and its append-only event log
    publish   sends changes to Supabase through report_registry()
"""
