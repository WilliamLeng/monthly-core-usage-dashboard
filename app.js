const state = {
  manifest: null,
  monthly: new Map(),
  selectedMonth: "",
  selectedRegion: "全部大区",
  selectedCompany: "全部分公司",
  selectedFunction: "全部核心功能",
  functionSort: "user_count",
  functionSortDirection: "desc",
  detailSort: "core_user_count",
  detailSortDirection: "desc",
};

const els = {
  loginOverlay: document.getElementById("loginOverlay"),
  passwordInput: document.getElementById("passwordInput"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),
  themeToggle: document.getElementById("themeToggle"),
  generatedAt: document.getElementById("generatedAt"),
  privacyNote: document.getElementById("privacyNote"),
  monthSelect: document.getElementById("monthSelect"),
  regionSelect: document.getElementById("regionSelect"),
  companySelect: document.getElementById("companySelect"),
  functionSelect: document.getElementById("functionSelect"),
  summaryGrid: document.getElementById("summaryGrid"),
  analysisTitle: document.getElementById("analysisTitle"),
  analysisScope: document.getElementById("analysisScope"),
  analysisGrid: document.getElementById("analysisGrid"),
  performanceTitle: document.getElementById("performanceTitle"),
  performanceDesc: document.getElementById("performanceDesc"),
  performanceMatrix: document.getElementById("performanceMatrix"),
  focusTitle: document.getElementById("focusTitle"),
  focusDesc: document.getElementById("focusDesc"),
  focusList: document.getElementById("focusList"),
  functionCards: document.getElementById("functionCards"),
  functionTableBody: document.getElementById("functionTableBody"),
  detailUserHeader: document.getElementById("detailUserHeader"),
  detailRateHeader: document.getElementById("detailRateHeader"),
  detailCountHeader: document.getElementById("detailCountHeader"),
  detailTableBody: document.getElementById("detailTableBody"),
};

const ACCESS_PASSWORD = "Fotile123";
const ACCESS_KEY = "coreUsageSiteAccess";
const THEME_KEY = "coreUsageSiteTheme";

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  document.querySelectorAll(".theme-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeValue === nextTheme);
  });
  if (els.themeToggle) {
    els.themeToggle.textContent = nextTheme === "dark" ? "切换浅色" : "切换暗色";
  }
}

function initAccessGate() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");

  if (localStorage.getItem(ACCESS_KEY) === "true") {
    els.loginOverlay.classList.add("hidden");
  }

  document.querySelectorAll(".theme-button").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeValue));
  });

  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  function checkPassword() {
    if (els.passwordInput.value === ACCESS_PASSWORD) {
      localStorage.setItem(ACCESS_KEY, "true");
      els.loginOverlay.classList.add("hidden");
      els.loginError.style.display = "none";
      return;
    }
    els.loginError.style.display = "block";
    els.passwordInput.value = "";
    els.passwordInput.focus();
  }

  els.loginButton.addEventListener("click", checkPassword);
  els.passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkPassword();
  });
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function fmtPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function fmtChange(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "暂无环比";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}${suffix || "%"}`;
}

function changeClass(value) {
  if (!value) return "";
  return value > 0 ? "up" : "down";
}

function sortRows(rows, key, direction) {
  const multiplier = direction === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    const left = a[key] ?? 0;
    const right = b[key] ?? 0;
    return (left - right) * multiplier;
  });
}

function updateSortButtons(tableName, activeKey, direction) {
  document.querySelectorAll(`.sort-button[data-table="${tableName}"]`).forEach((button) => {
    const active = button.dataset.sort === activeKey;
    button.classList.toggle("active", active);
    button.classList.toggle("asc", active && direction === "asc");
    button.title = active
      ? `当前按${button.textContent} ${direction === "asc" ? "从低到高" : "从高到低"}排序，点击切换方向`
      : `点击按${button.textContent}排序`;
  });
}

function byMonth(month) {
  return state.monthly.get(month);
}

function previousMonth() {
  const months = state.manifest.months.map((item) => item.month);
  const index = months.indexOf(state.selectedMonth);
  if (index <= 0) return null;
  return months[index - 1];
}

function getCurrentData() {
  return byMonth(state.selectedMonth);
}

function getScopeCompanies(data = getCurrentData()) {
  return data.companies.filter((item) => {
    const regionMatch = state.selectedRegion === "全部大区" || item.region === state.selectedRegion;
    const companyMatch = state.selectedCompany === "全部分公司" || item.company === state.selectedCompany;
    return regionMatch && companyMatch;
  });
}

function getFunctionValue(record, functionName = state.selectedFunction) {
  if (functionName === "全部核心功能") return null;
  return record.functions.find((item) => item.name === functionName) || null;
}

function aggregateScope(companies, functionName = state.selectedFunction) {
  const totalPeople = companies.reduce((sum, item) => sum + item.total_people, 0);
  if (functionName === "全部核心功能") {
    const coreUserCount = companies.reduce((sum, item) => sum + item.core_user_count, 0);
    return {
      total_people: totalPeople,
      user_count: coreUserCount,
      use_count: companies.reduce((sum, item) => sum + item.total_use_count, 0),
      usage_rate: totalPeople ? coreUserCount / totalPeople : 0,
      company_count: companies.length,
    };
  }

  const userCount = companies.reduce((sum, item) => sum + (getFunctionValue(item, functionName)?.user_count || 0), 0);
  return {
    total_people: totalPeople,
    user_count: userCount,
    use_count: companies.reduce((sum, item) => sum + (getFunctionValue(item, functionName)?.use_count || 0), 0),
    usage_rate: totalPeople ? userCount / totalPeople : 0,
    company_count: companies.length,
  };
}

function scopeForMonth(month) {
  const data = byMonth(month);
  if (!data) return null;
  const companies = data.companies.filter((item) => {
    const regionMatch = state.selectedRegion === "全部大区" || item.region === state.selectedRegion;
    const companyMatch = state.selectedCompany === "全部分公司" || item.company === state.selectedCompany;
    return regionMatch && companyMatch;
  });
  return aggregateScope(companies);
}

function scopeLabel() {
  const parts = [state.selectedMonth];
  if (state.selectedRegion !== "全部大区") parts.push(state.selectedRegion);
  if (state.selectedCompany !== "全部分公司") parts.push(state.selectedCompany);
  if (state.selectedFunction !== "全部核心功能") parts.push(state.selectedFunction);
  return parts.join(" / ");
}

function getMom() {
  const previous = previousMonth();
  if (!previous) return null;
  const currentScope = aggregateScope(getScopeCompanies());
  const previousScope = scopeForMonth(previous);
  if (!previousScope || !previousScope.usage_rate) return null;
  return currentScope.usage_rate - previousScope.usage_rate;
}

function functionAcrossScope(functionName, companies = getScopeCompanies()) {
  const totalPeople = companies.reduce((sum, item) => sum + item.total_people, 0);
  const userCount = companies.reduce((sum, item) => sum + (item.functions.find((fn) => fn.name === functionName)?.user_count || 0), 0);
  const useCount = companies.reduce((sum, item) => sum + (item.functions.find((fn) => fn.name === functionName)?.use_count || 0), 0);
  const coveredCompanies = companies.filter((item) => (item.functions.find((fn) => fn.name === functionName)?.user_count || 0) > 0).length;
  return {
    name: functionName,
    user_count: userCount,
    usage_rate: totalPeople ? userCount / totalPeople : 0,
    use_count: useCount,
    covered_companies: coveredCompanies,
  };
}

function functionMom(functionName) {
  const previous = previousMonth();
  if (!previous) return null;
  const current = functionAcrossScope(functionName, getScopeCompanies());
  const previousData = byMonth(previous);
  const previousCompanies = previousData.companies.filter((item) => {
    const regionMatch = state.selectedRegion === "全部大区" || item.region === state.selectedRegion;
    const companyMatch = state.selectedCompany === "全部分公司" || item.company === state.selectedCompany;
    return regionMatch && companyMatch;
  });
  const last = functionAcrossScope(functionName, previousCompanies);
  return current.usage_rate - last.usage_rate;
}

function riskCompaniesForFunction(functionName, companies = getScopeCompanies()) {
  const average = functionAcrossScope(functionName, companies).usage_rate;
  return companies.filter((item) => {
    const fn = item.functions.find((entry) => entry.name === functionName);
    return fn && fn.usage_rate < average * 0.7;
  });
}

function populateSelect(select, values, selected) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  select.value = selected;
}

function initFilters() {
  const months = state.manifest.months.map((item) => item.month);
  state.selectedMonth = months.at(-1);
  populateSelect(els.monthSelect, months, state.selectedMonth);
  populateSelect(els.functionSelect, ["全部核心功能", ...state.manifest.functions], state.selectedFunction);
  updateRegionCompanyOptions();
}

function updateRegionCompanyOptions() {
  const data = getCurrentData();
  const regions = ["全部大区", ...new Set(data.companies.map((item) => item.region).filter(Boolean))];
  if (!regions.includes(state.selectedRegion)) state.selectedRegion = "全部大区";
  populateSelect(els.regionSelect, regions, state.selectedRegion);

  const companyBase = data.companies.filter((item) => state.selectedRegion === "全部大区" || item.region === state.selectedRegion);
  const companies = ["全部分公司", ...new Set(companyBase.map((item) => item.company).filter(Boolean))];
  if (!companies.includes(state.selectedCompany)) state.selectedCompany = "全部分公司";
  populateSelect(els.companySelect, companies, state.selectedCompany);
}

function renderSummary() {
  const companies = getScopeCompanies();
  const scope = aggregateScope(companies);
  const mom = getMom();
  const riskCount = state.selectedFunction === "全部核心功能"
    ? companies.filter((item) => item.core_usage_rate < scope.usage_rate * 0.7).length
    : riskCompaniesForFunction(state.selectedFunction, companies).length;

  els.summaryGrid.innerHTML = [
    ["三类人员总人数", fmtNumber(scope.total_people), `覆盖 ${scope.company_count} 家分公司`, ""],
    [state.selectedFunction === "全部核心功能" ? "使用核心功能人数" : "功能使用人数", fmtNumber(scope.user_count), `使用率 ${fmtPercent(scope.usage_rate)}`, ""],
    ["使用率", fmtPercent(scope.usage_rate), `环比 ${fmtChange(mom)}`, changeClass(mom)],
    ["重点关注分公司", fmtNumber(riskCount), "低于当前范围均值 30% 以上", riskCount ? "down" : ""],
  ].map(([title, value, footer, cls]) => `
    <article class="kpi-card">
      <p class="kpi-title">${title}</p>
      <div class="kpi-value">${value}</div>
      <span class="kpi-change ${cls}">${footer}</span>
    </article>
  `).join("");
}

function renderAnalysis() {
  const companies = getScopeCompanies();
  const scope = aggregateScope(companies);
  const mom = getMom();
  const functionStats = state.manifest.functions.map((name) => ({
    ...functionAcrossScope(name, companies),
    mom: functionMom(name),
  }));
  const topFunction = [...functionStats].sort((a, b) => b.usage_rate - a.usage_rate)[0];
  const growthFunction = [...functionStats].filter((item) => item.mom !== null).sort((a, b) => b.mom - a.mom)[0];
  const lowFunction = [...functionStats].sort((a, b) => a.usage_rate - b.usage_rate)[0];
  const riskCompanies = companies
    .filter((item) => item.core_usage_rate < scope.usage_rate * 0.7)
    .sort((a, b) => a.core_usage_rate - b.core_usage_rate);

  els.analysisTitle.textContent = state.selectedCompany === "全部分公司" ? "本月总部分析" : "分公司体检";
  els.analysisScope.textContent = `当前范围：${scopeLabel()}`;
  els.analysisGrid.innerHTML = [
    {
      title: "一句话结论",
      body: `${scopeLabel()} 使用率 ${fmtPercent(scope.usage_rate)}，环比 ${fmtChange(mom)}。${riskCompanies.length ? `当前有 ${riskCompanies.length} 家分公司明显低于均值。` : "当前范围内暂无明显低于均值的分公司。"}`,
    },
    {
      title: "主要变化",
      body: growthFunction ? `${growthFunction.name} 环比变化最高，为 ${fmtChange(growthFunction.mom)}；${topFunction.name} 当前使用率最高，为 ${fmtPercent(topFunction.usage_rate)}。` : "暂无可比较的上月数据。",
    },
    {
      title: "重点关注",
      body: lowFunction ? `${lowFunction.name} 当前使用率 ${fmtPercent(lowFunction.usage_rate)}，属于当前范围内低渗透功能；建议结合业务场景判断是否需要推动。` : "暂无低渗透功能。",
    },
    {
      title: "建议动作",
      body: riskCompanies.length ? `优先跟进 ${riskCompanies.slice(0, 3).map((item) => item.company).join("、")}，并复盘高使用率分公司的动作。` : "可优先复盘高表现分公司经验，并观察低渗透功能是否具备推广价值。",
    },
  ].map((card) => `
    <article class="analysis-card">
      <h3>${card.title}</h3>
      <p>${card.body}</p>
    </article>
  `).join("");
}

function renderPerformance() {
  const data = getCurrentData();
  if (state.selectedCompany !== "全部分公司") {
    const company = getScopeCompanies()[0];
    els.performanceTitle.textContent = "分公司功能体检";
    els.performanceDesc.textContent = "选中分公司后，查看该公司各功能使用率。";
    els.performanceMatrix.innerHTML = company.functions
      .slice()
      .sort((a, b) => b.usage_rate - a.usage_rate)
      .slice(0, 8)
      .map((fn) => matrixRow(fn.name, fn.usage_rate))
      .join("");
    return;
  }

  const rows = state.selectedRegion === "全部大区" ? data.regions : getScopeCompanies();
  els.performanceTitle.textContent = state.selectedRegion === "全部大区" ? "大区表现" : `${state.selectedRegion}分公司表现`;
  els.performanceDesc.textContent = state.selectedRegion === "全部大区" ? "按核心功能使用率排序。" : "当前大区下按核心功能使用率排序。";
  els.performanceMatrix.innerHTML = rows
    .slice()
    .sort((a, b) => b.core_usage_rate - a.core_usage_rate)
    .slice(0, 10)
    .map((item) => matrixRow(item.company || item.region, item.core_usage_rate))
    .join("");
}

function matrixRow(name, rate) {
  const cls = rate >= 0.65 ? "good" : rate >= 0.45 ? "warn" : "risk";
  return `
    <div class="matrix-row">
      <strong>${name}</strong>
      <span class="progress ${cls}"><i style="width: ${Math.min(rate * 100, 100)}%"></i></span>
      <span>${fmtPercent(rate)}</span>
    </div>
  `;
}

function renderFocusList() {
  const companies = getScopeCompanies();
  const scope = aggregateScope(companies);
  const sortedLow = companies
    .filter((item) => item.core_usage_rate < scope.usage_rate * 0.7)
    .sort((a, b) => a.core_usage_rate - b.core_usage_rate)
    .slice(0, 4);
  const sortedHigh = companies
    .slice()
    .sort((a, b) => b.core_usage_rate - a.core_usage_rate)
    .slice(0, Math.max(0, 4 - sortedLow.length));
  const items = [
    ...sortedLow.map((item) => ({ type: "需关注", cls: "warning", item })),
    ...sortedHigh.map((item) => ({ type: "可复盘", cls: "good", item })),
  ];

  els.focusTitle.textContent = state.selectedCompany === "全部分公司" ? "本月关注名单" : "同公司功能短板";
  els.focusDesc.textContent = state.selectedCompany === "全部分公司"
    ? "识别该跟进的分公司和可复盘的分公司。"
    : "选中分公司后，建议重点看使用率最低的功能。";

  if (state.selectedCompany !== "全部分公司") {
    const company = companies[0];
    const weakFunctions = company.functions.slice().sort((a, b) => a.usage_rate - b.usage_rate).slice(0, 4);
    els.focusList.innerHTML = weakFunctions.map((fn) => `
      <li class="focus-item">
        <span class="tag warning">短板</span>
        <div>
          <div class="rank-name">${fn.name}</div>
          <div class="rank-meta">使用人数 ${fmtNumber(fn.user_count)}，使用次数 ${fmtNumber(fn.use_count)}</div>
        </div>
        <strong>${fmtPercent(fn.usage_rate)}</strong>
      </li>
    `).join("");
    return;
  }

  els.focusList.innerHTML = items.map(({ type, cls, item }) => `
    <li class="focus-item">
      <span class="tag ${cls}">${type}</span>
      <div>
        <div class="rank-name">${item.company}</div>
        <div class="rank-meta">${item.region} · 使用人数 ${fmtNumber(item.core_user_count)} / ${fmtNumber(item.total_people)}</div>
      </div>
      <strong>${fmtPercent(item.core_usage_rate)}</strong>
    </li>
  `).join("") || `<li class="empty">当前筛选范围暂无关注对象。</li>`;
}

function functionAction(item) {
  if (item.usage_rate >= 0.45) return "补齐低使用分公司";
  if (item.mom !== null && item.mom > 0.03) return "复盘增长来源并复制";
  if (item.usage_rate < 0.05) return "先判断真实使用场景";
  return "结合场景做培训";
}

function renderFunctionAnalysis() {
  const companies = getScopeCompanies();
  const rows = state.manifest.functions.map((name) => {
    const current = functionAcrossScope(name, companies);
    const mom = functionMom(name);
    return {
      ...current,
      mom,
      risk_count: riskCompaniesForFunction(name, companies).length,
    };
  });
  sortRows(rows, state.functionSort, state.functionSortDirection);
  updateSortButtons("function", state.functionSort, state.functionSortDirection);

  const top = rows.slice().sort((a, b) => b.usage_rate - a.usage_rate)[0];
  const growth = rows.filter((item) => item.mom !== null).slice().sort((a, b) => b.mom - a.mom)[0];
  const low = rows.slice().sort((a, b) => a.usage_rate - b.usage_rate)[0];
  els.functionCards.innerHTML = [
    ["基础能力", `${top.name} 使用人数 ${fmtNumber(top.user_count)}，使用率 ${fmtPercent(top.usage_rate)}，覆盖 ${top.covered_companies} 家分公司。`],
    ["增长机会", growth ? `${growth.name} 环比 ${fmtChange(growth.mom)}，可复盘高表现区域。` : "暂无上月可比数据。"],
    ["低渗透功能", `${low.name} 使用率 ${fmtPercent(low.usage_rate)}，关注分公司 ${low.risk_count} 家，需要判断场景和培训问题。`],
  ].map(([title, body]) => `
    <article class="analysis-card">
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `).join("");

  els.functionTableBody.innerHTML = rows.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td>${fmtNumber(item.user_count)}</td>
      <td>${fmtPercent(item.usage_rate)}</td>
      <td class="${changeClass(item.mom)}">${fmtChange(item.mom)}</td>
      <td>${fmtNumber(item.covered_companies)}</td>
      <td>${fmtNumber(item.risk_count)}</td>
      <td>${functionAction(item)}</td>
    </tr>
  `).join("");
}

function renderDetailTable() {
  const companies = getScopeCompanies();
  const functionSelected = state.selectedFunction !== "全部核心功能";
  els.detailUserHeader.textContent = functionSelected ? "功能使用人数" : "使用核心功能人数";
  els.detailRateHeader.textContent = functionSelected ? "功能使用率" : "核心功能使用率";
  els.detailCountHeader.textContent = functionSelected ? "功能使用次数" : "总使用次数";
  const rows = companies.map((company) => {
    if (!functionSelected) {
      return {
        ...company,
        display_user_count: company.core_user_count,
        display_usage_rate: company.core_usage_rate,
        display_use_count: company.total_use_count,
      };
    }
    const fn = getFunctionValue(company, state.selectedFunction) || {};
    return {
      ...company,
      display_user_count: fn.user_count || 0,
      display_usage_rate: fn.usage_rate || 0,
      display_use_count: fn.use_count || 0,
      core_user_count: fn.user_count || 0,
      core_usage_rate: fn.usage_rate || 0,
      total_use_count: fn.use_count || 0,
    };
  });

  sortRows(rows, state.detailSort, state.detailSortDirection);
  updateSortButtons("detail", state.detailSort, state.detailSortDirection);
  els.detailTableBody.innerHTML = rows.slice(0, 120).map((company) => `
    <tr>
      <td>${state.selectedMonth}</td>
      <td>${company.region}</td>
      <td>${company.company}</td>
      <td>${fmtNumber(company.total_people)}</td>
      <td>${fmtNumber(company.display_user_count)}</td>
      <td>${fmtPercent(company.display_usage_rate)}</td>
      <td>${fmtNumber(company.display_use_count)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty">当前筛选范围暂无数据。</td></tr>`;
}

function renderAll() {
  updateRegionCompanyOptions();
  renderSummary();
  renderAnalysis();
  renderPerformance();
  renderFocusList();
  renderFunctionAnalysis();
  renderDetailTable();
}

function bindEvents() {
  els.monthSelect.addEventListener("change", () => {
    state.selectedMonth = els.monthSelect.value;
    renderAll();
  });
  els.regionSelect.addEventListener("change", () => {
    state.selectedRegion = els.regionSelect.value;
    state.selectedCompany = "全部分公司";
    renderAll();
  });
  els.companySelect.addEventListener("change", () => {
    state.selectedCompany = els.companySelect.value;
    renderAll();
  });
  els.functionSelect.addEventListener("change", () => {
    state.selectedFunction = els.functionSelect.value;
    renderAll();
  });
  document.querySelectorAll(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      const table = button.dataset.table;
      const key = button.dataset.sort;
      if (table === "function") {
        state.functionSortDirection = state.functionSort === key && state.functionSortDirection === "desc" ? "asc" : "desc";
        state.functionSort = key;
        renderFunctionAnalysis();
      }
      if (table === "detail") {
        state.detailSortDirection = state.detailSort === key && state.detailSortDirection === "desc" ? "asc" : "desc";
        state.detailSort = key;
        renderDetailTable();
      }
    });
  });
}

async function init() {
  initAccessGate();
  state.manifest = await fetch("./data/manifest.json").then((res) => res.json());
  await Promise.all(state.manifest.months.map(async (month) => {
    const data = await fetch(`./${month.file}`).then((res) => res.json());
    state.monthly.set(month.month, data);
  }));
  els.generatedAt.textContent = `数据生成：${state.manifest.generated_at}`;
  els.privacyNote.textContent = state.manifest.privacy_note;
  initFilters();
  bindEvents();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="page"><section class="panel"><h1>数据读取失败</h1><p>${error.message}</p></section></main>`;
});
