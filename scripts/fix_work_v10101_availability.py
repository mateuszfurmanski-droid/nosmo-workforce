from pathlib import Path

RUNTIME = Path("apps/work/js/work-v1-runtime.js")
PROMOTE = Path("scripts/promote_work_v10101.py")


def patch_runtime(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if "let availabilitySyncing=false;" not in text:
        text = text.replace(
            "  function currentAvailability(){",
            "  let availabilitySyncing=false;\n  function currentAvailability(){",
            1,
        )

    start_old = "  function saveAvailability(next){\n    const value={state:next.state,date:next.state==='from-date'?(next.date||''):''};"
    start_new = "  function saveAvailability(next){\n    if(availabilitySyncing)return;\n    availabilitySyncing=true;\n    try{\n      const value={state:next.state,date:next.state==='from-date'?(next.date||''):''};"
    if start_old in text:
        text = text.replace(start_old, start_new, 1)

    end_old = "    renderAvailabilityCompact();syncAvailabilityFields();\n  }\n  function availabilityLabel"
    end_new = "      renderAvailabilityCompact();syncAvailabilityFields();\n    } finally { availabilitySyncing=false; }\n  }\n  function availabilityLabel"
    if end_old in text:
        text = text.replace(end_old, end_new, 1)

    assert "let availabilitySyncing=false;" in text
    assert "if(availabilitySyncing)return;" in text
    assert "finally { availabilitySyncing=false; }" in text
    path.write_text(text, encoding="utf-8")


patch_runtime(RUNTIME)

marker = "# V1.0101 availability re-entrancy patch"
promote = PROMOTE.read_text(encoding="utf-8")
if marker not in promote:
    promote += r'''

# V1.0101 availability re-entrancy patch
runtime_path = WORK / "js" / "work-v1-runtime.js"
runtime_text = runtime_path.read_text(encoding="utf-8")
if "let availabilitySyncing=false;" not in runtime_text:
    runtime_text = runtime_text.replace(
        "  function currentAvailability(){",
        "  let availabilitySyncing=false;\n  function currentAvailability(){",
        1,
    )
runtime_text = runtime_text.replace(
    "  function saveAvailability(next){\n    const value={state:next.state,date:next.state==='from-date'?(next.date||''):''};",
    "  function saveAvailability(next){\n    if(availabilitySyncing)return;\n    availabilitySyncing=true;\n    try{\n      const value={state:next.state,date:next.state==='from-date'?(next.date||''):''};",
    1,
)
runtime_text = runtime_text.replace(
    "    renderAvailabilityCompact();syncAvailabilityFields();\n  }\n  function availabilityLabel",
    "      renderAvailabilityCompact();syncAvailabilityFields();\n    } finally { availabilitySyncing=false; }\n  }\n  function availabilityLabel",
    1,
)
assert "if(availabilitySyncing)return;" in runtime_text
runtime_path.write_text(runtime_text, encoding="utf-8")
'''
    PROMOTE.write_text(promote, encoding="utf-8")

print("NOSMO_WORK_V1_0101_AVAILABILITY_FIX_READY")
