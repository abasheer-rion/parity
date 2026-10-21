import json

from parity import ledger


def _use_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(ledger, "DETAILS", tmp_path / "runs")
    return tmp_path / "runs.jsonl"


def test_chain_is_intact_after_appends(tmp_path, monkeypatch):
    chain = _use_tmp(tmp_path, monkeypatch)
    for i in range(3):
        ledger.append({"kind": "official", "results": {"x": {"trials": 2}}}, {"n": i}, chain)
    assert ledger.verify(chain, tmp_path / "runs") == []
    ids = [e["run_id"] for e in ledger.entries(chain)]
    assert ids == ["RUN-000001", "RUN-000002", "RUN-000003"]
    assert ledger.trials_so_far(["x"], chain) == 6


def test_editing_a_past_entry_is_caught(tmp_path, monkeypatch):
    chain = _use_tmp(tmp_path, monkeypatch)
    for i in range(3):
        ledger.append({"kind": "official", "sharpe": 0.1}, {"n": i}, chain)
    lines = chain.read_text().splitlines()
    first = json.loads(lines[0])
    first["sharpe"] = 9.9  # someone improves an old result
    lines[0] = json.dumps(first, sort_keys=True, separators=(",", ":"))
    chain.write_text("\n".join(lines) + "\n")
    problems = ledger.verify(chain, tmp_path / "runs")
    assert any("RUN-000001" in p and "hash" in p for p in problems)


def test_editing_a_details_file_is_caught(tmp_path, monkeypatch):
    chain = _use_tmp(tmp_path, monkeypatch)
    ledger.append({"kind": "official"}, {"sharpe": 0.1}, chain)
    detail = tmp_path / "runs" / "RUN-000001.json"
    detail.write_text(detail.read_text().replace("0.1", "0.9"))
    assert any("details file was changed" in p for p in ledger.verify(chain, tmp_path / "runs"))


def test_deleting_an_entry_is_caught(tmp_path, monkeypatch):
    chain = _use_tmp(tmp_path, monkeypatch)
    for i in range(3):
        ledger.append({"kind": "official"}, {"n": i}, chain)
    lines = chain.read_text().splitlines()
    chain.write_text("\n".join([lines[0], lines[2]]) + "\n")
    assert ledger.verify(chain, tmp_path / "runs")


def test_refuses_to_append_to_a_broken_ledger(tmp_path, monkeypatch):
    chain = _use_tmp(tmp_path, monkeypatch)
    ledger.append({"kind": "official"}, {"n": 1}, chain)
    chain.write_text(chain.read_text().replace("official", "forged"))
    try:
        ledger.append({"kind": "official"}, {"n": 2}, chain)
    except RuntimeError:
        return
    raise AssertionError("append should refuse a broken ledger")
