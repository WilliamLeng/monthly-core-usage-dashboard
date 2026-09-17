from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "月度数据每月原始数据"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data"
MONTHLY_DIR = OUTPUT_DIR / "monthly"

MONTH_FILES = [
    ("2026-03", SOURCE_DIR / "26年3月" / "3月三类人员核心功能使用分析.xlsx"),
    ("2026-04", SOURCE_DIR / "26年4月" / "4月三类人员核心功能使用分析.xlsx"),
    ("2026-05", SOURCE_DIR / "26年5月" / "5月三类人员核心功能使用分析.xlsx"),
    ("2026-06", SOURCE_DIR / "26年6月" / "6月三类人员核心功能使用分析.xlsx"),
    ("2026-07", SOURCE_DIR / "26年7月" / "7月三类人员核心功能使用分析.xlsx"),
    ("2026-08", SOURCE_DIR / "26年8月" / "8月三类人员核心功能使用分析.xlsx"),
]

BASE_COLUMNS = {
    "大区",
    "分公司",
    "三类人员人数",
    "使用核心功能人数",
    "未使用核心功能人数",
    "核心功能使用率",
}

EXCLUDED_REGIONS = {"零售业务部", "未填写", "幸福家"}
EXCLUDED_COMPANIES = {
    "上海幸福家",
    "互联网测试公司",
    "北京超级体验店",
    "CS测试分公司电商业务部",
    "大客户业务部",
}


def clean_number(value):
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return value
    text = str(value).replace(",", "").strip()
    if not text:
        return 0
    try:
        return float(text)
    except ValueError:
        return 0


def ratio(value):
    number = clean_number(value)
    return round(float(number), 6)


def count(value):
    return int(round(float(clean_number(value))))


def rows_from_sheet(ws):
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
      return [], []
    headers = [str(item).strip() if item is not None else "" for item in rows[0]]
    return headers, rows[1:]


def discover_functions(headers):
    functions = []
    for header in headers:
        if not header or header in BASE_COLUMNS:
            continue
        if header.endswith("使用人数"):
            function_name = header[: -len("使用人数")]
            rate_header = f"{function_name}使用率"
            if rate_header in headers:
                functions.append(function_name)
    return functions


def row_to_dict(headers, row):
    return {headers[index]: row[index] if index < len(row) else None for index in range(len(headers))}


def is_excluded_scope(region, company=None):
    return region in EXCLUDED_REGIONS or company in EXCLUDED_COMPANIES


def aggregate_usage_counts(person_headers, person_rows, scope_keys, functions):
    count_headers = {function: f"{function}次数" for function in functions}
    result = defaultdict(lambda: defaultdict(int))

    for row in person_rows:
        item = row_to_dict(person_headers, row)
        if is_excluded_scope(item.get("大区"), item.get("分公司")):
            continue
        key = tuple(item.get(field) for field in scope_keys)
        for function, header in count_headers.items():
            result[key][function] += count(item.get(header))

    return result


def build_scope_records(headers, rows, functions, scope_keys, usage_counts):
    records = []
    for row in rows:
        item = row_to_dict(headers, row)
        region = item.get("大区")
        company = item.get("分公司") if "分公司" in scope_keys else None
        if not region or region == "合计" or company == "合计" or is_excluded_scope(region, company):
            continue
        key = tuple(item.get(field) for field in scope_keys)
        total_people = count(item.get("三类人员人数"))
        used_people = count(item.get("使用核心功能人数"))
        core_rate = ratio(item.get("核心功能使用率"))

        record = {
            "region": region,
            "company": company,
            "total_people": total_people,
            "core_user_count": used_people,
            "not_used_count": count(item.get("未使用核心功能人数")),
            "core_usage_rate": core_rate,
            "total_use_count": sum(usage_counts[key].values()),
            "functions": [],
        }

        for function in functions:
            user_count = count(item.get(f"{function}使用人数"))
            use_count = usage_counts[key].get(function, 0)
            record["functions"].append(
                {
                    "name": function,
                    "user_count": user_count,
                    "usage_rate": ratio(item.get(f"{function}使用率")),
                    "use_count": use_count,
                }
            )

        records.append(record)
    return records


def summarize_month(month, workbook_path):
    wb = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    region_ws = wb["大区汇总"]
    company_ws = wb["分公司汇总"]
    person_ws = wb["人员明细"]

    region_headers, region_rows = rows_from_sheet(region_ws)
    company_headers, company_rows = rows_from_sheet(company_ws)
    person_headers, person_rows = rows_from_sheet(person_ws)
    functions = discover_functions(company_headers)

    region_usage = aggregate_usage_counts(person_headers, person_rows, ["大区"], functions)
    company_usage = aggregate_usage_counts(person_headers, person_rows, ["大区", "分公司"], functions)

    regions = build_scope_records(region_headers, region_rows, functions, ["大区"], region_usage)
    companies = build_scope_records(company_headers, company_rows, functions, ["大区", "分公司"], company_usage)

    totals = {
        "total_people": sum(item["total_people"] for item in companies),
        "core_user_count": sum(item["core_user_count"] for item in companies),
        "not_used_count": sum(item["not_used_count"] for item in companies),
        "total_use_count": sum(item["total_use_count"] for item in companies),
        "region_count": len([item for item in regions if item["region"]]),
        "company_count": len([item for item in companies if item["company"]]),
    }
    totals["core_usage_rate"] = (
        round(totals["core_user_count"] / totals["total_people"], 6)
        if totals["total_people"]
        else 0
    )

    function_totals = []
    for function in functions:
        user_count = sum(
            item["functions"][index]["user_count"]
            for item in companies
            for index, fn in enumerate(item["functions"])
            if fn["name"] == function
        )
        use_count = sum(
            item["functions"][index]["use_count"]
            for item in companies
            for index, fn in enumerate(item["functions"])
            if fn["name"] == function
        )
        covered_companies = sum(
            1 for item in companies for fn in item["functions"] if fn["name"] == function and fn["user_count"] > 0
        )
        function_totals.append(
            {
                "name": function,
                "user_count": user_count,
                "usage_rate": round(user_count / totals["total_people"], 6)
                if totals["total_people"]
                else 0,
                "use_count": use_count,
                "covered_companies": covered_companies,
            }
        )

    return {
        "month": month,
        "source_file": str(workbook_path.relative_to(ROOT)),
        "totals": totals,
        "functions": function_totals,
        "regions": regions,
        "companies": companies,
    }


def natural_month_label(month):
    matched = re.match(r"(\d{4})-(\d{2})", month)
    if not matched:
        return month
    return f"{int(matched.group(2))}月"


def main():
    MONTHLY_DIR.mkdir(parents=True, exist_ok=True)

    manifest_months = []
    functions = []
    for month, path in MONTH_FILES:
        if not path.exists():
            raise FileNotFoundError(path)
        data = summarize_month(month, path)
        functions = data["functions"]
        output_path = MONTHLY_DIR / f"{month}.json"
        output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest_months.append(
            {
                "month": month,
                "label": natural_month_label(month),
                "file": f"data/monthly/{month}.json",
            }
        )

    manifest = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "months": manifest_months,
        "functions": [item["name"] for item in functions],
        "privacy_note": "仅包含大区、分公司、功能维度汇总数据，不包含人员姓名、编码或个人明细。",
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
