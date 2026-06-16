const STORAGE_KEY = "useful-apps-ledger-v4";
const START_DATE = "2026-03-01";
const APP_NAME = "Gautam's Apps";
const LEGACY_APP_NAME = "Useful Apps";

localStorage.removeItem("opus-finance-tracker-v1");
localStorage.removeItem("opus-finance-tracker-v2");
localStorage.removeItem("useful-apps-ledger-v3");

const initialState = {
  company: {
    company: APP_NAME,
    ceo: "Gautam Dogra",
    entity: "Startup portfolio",
    card: "Company card",
    bank: "Startup bank account",
    approvalThreshold: 0,
    invoicePrefix: "UA",
    nextInvoiceNumber: 1
  },
  partners: {
    partnerA: "Fareed Kureshy",
    phoneA: "",
    partnerB: 'Gayland "Bud" Smith',
    phoneB: ""
  },
  users: [
    {
      id: "gautam",
      name: "Gautam Dogra",
      email: "gautam@usefulapps.local",
      orgs: [APP_NAME, "OpusOptionsTrading Inc.", "299trust", "oncosaferx.com", "SiteBoss"],
      role: "admin"
    },
    {
      id: "opus-viewer",
      name: "Opus viewer",
      email: "viewer@opusoptionstrading.ai",
      orgs: ["OpusOptionsTrading Inc."],
      role: "viewer"
    },
    {
      id: "299trust-viewer",
      name: "299trust viewer",
      email: "viewer@299trust.local",
      orgs: ["299trust"],
      role: "viewer"
    }
  ],
  activeUserId: "gautam",
  activeProjectId: "all",
  formMemory: {
    vendors: {},
    customers: {},
    contributors: {}
  },
  supabase: {
    projectId: "pmyqsieamfohrywdpora",
    url: "https://pmyqsieamfohrywdpora.supabase.co/rest/v1/",
    anonKey: "sb_publishable_AzNVd4jhVI1SFM0bgADBGQ_b4_Sukfn",
    enabled: false,
    lastSync: "",
    lastStatus: "Not connected"
  },
  projects: [
    {
      id: "opusoptionstrading",
      name: "opusoptionstrading.ai",
      owner: "OpusOptionsTrading Inc.",
      url: "opusoptionstrading.ai",
      rate: 150,
      org: "OpusOptionsTrading Inc.",
      allowedViewers: [],
      status: "Beta / furthest along",
      budget: 0,
      priority: 1,
      plannedShare: 70
    },
    {
      id: "299trust",
      name: "299trust",
      owner: APP_NAME,
      url: "299trust",
      rate: 150,
      org: "299trust",
      allowedViewers: [],
      status: "Done",
      budget: 0,
      priority: 2,
      plannedShare: 15
    },
    {
      id: "oncosaferx",
      name: "oncosaferx.com",
      owner: APP_NAME,
      url: "oncosaferx.com",
      rate: 150,
      org: "oncosaferx.com",
      allowedViewers: [],
      status: "Exploring",
      budget: 0,
      priority: 3,
      plannedShare: 8
    },
    {
      id: "siteboss",
      name: "SiteBoss",
      owner: APP_NAME,
      url: "siteboss",
      rate: 150,
      org: "SiteBoss",
      allowedViewers: [],
      status: "Building",
      budget: 0,
      priority: 4,
      plannedShare: 7
    }
  ],
  timeEntries: [],
  expenses: [],
  income: [],
  funds: [],
  audit: []
};

let state = loadState();
let supabaseSyncTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);

const htmlEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const shortDate = (date) => {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return migrateAppName(structuredClone(initialState));
  try {
    const parsed = JSON.parse(saved);
    return migrateAppName({
      ...structuredClone(initialState),
      ...parsed,
      company: { ...initialState.company, ...(parsed.company || {}) },
      partners: { ...initialState.partners, ...(parsed.partners || {}) },
      users: parsed.users || initialState.users,
      activeUserId: parsed.activeUserId || initialState.activeUserId,
      activeProjectId: parsed.activeProjectId || initialState.activeProjectId,
      formMemory: {
        ...initialState.formMemory,
        ...(parsed.formMemory || {})
      },
      supabase: normalizeSupabaseConfig(parsed.supabase),
      projects: normalizeProjects(parsed.projects || initialState.projects),
      funds: parsed.funds || [],
      audit: parsed.audit || []
    });
  } catch {
    return migrateAppName(structuredClone(initialState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleSupabaseSync();
}

function setSupabaseStatus(message) {
  state.supabase.lastStatus = message;
  const status = $("#supabase-status");
  if (status) status.textContent = message;
}

function supabaseReady() {
  return Boolean(state.supabase?.enabled && state.supabase?.url && state.supabase?.anonKey);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: state.supabase.anonKey,
    Authorization: `Bearer ${state.supabase.anonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function supabaseRestUrl() {
  let raw = String(state.supabase.url || "").trim().replace(/\/+$/, "");
  if (!raw || raw.startsWith("/")) raw = initialState.supabase.url.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error("Supabase API URL must start with https://");
  }
  return raw.endsWith("/rest/v1") ? raw : `${raw}/rest/v1`;
}

function sanitizedRemoteState() {
  const clone = structuredClone(state);
  if (clone.supabase) clone.supabase.anonKey = "";
  return clone;
}

function scheduleSupabaseSync() {
  if (!supabaseReady()) return;
  window.clearTimeout(supabaseSyncTimer);
  supabaseSyncTimer = window.setTimeout(() => {
    pushStateToSupabase({ quiet: true });
  }, 900);
}

async function pushStateToSupabase({ quiet = false } = {}) {
  if (!supabaseReady()) {
    setSupabaseStatus("Supabase sync is not configured.");
    return;
  }
  try {
    const response = await fetch(`${supabaseRestUrl()}/useful_apps_state`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        id: "default",
        data: sanitizedRemoteState(),
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(await response.text());
    state.supabase.lastSync = new Date().toISOString();
    setSupabaseStatus(`Synced to Supabase at ${new Date(state.supabase.lastSync).toLocaleString()}`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (!quiet) setSupabaseStatus(`Supabase push failed: ${error.message}`);
  }
}

async function loadStateFromSupabase() {
  if (!supabaseReady()) {
    setSupabaseStatus("Supabase sync is not configured.");
    return;
  }
  try {
    const response = await fetch(`${supabaseRestUrl()}/useful_apps_state?id=eq.default&select=data,updated_at`, {
      headers: supabaseHeaders()
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    if (!rows.length) {
      setSupabaseStatus("No Supabase state found yet. Push current app state first.");
      return;
    }
    const localSupabase = structuredClone(state.supabase);
    state = migrateAppName({
      ...structuredClone(initialState),
      ...rows[0].data,
      supabase: {
        ...localSupabase,
        lastSync: rows[0].updated_at,
        lastStatus: `Loaded from Supabase at ${new Date().toLocaleString()}`
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  } catch (error) {
    setSupabaseStatus(`Supabase load failed: ${error.message}`);
  }
}

function normalizeProjects(projects) {
  return projects.map((project, index) => ({
    ...project,
    org: project.org || project.owner || APP_NAME,
    allowedViewers: Array.isArray(project.allowedViewers)
      ? project.allowedViewers
      : splitList(project.allowedViewers),
    priority: Number(project.priority || index + 1),
    plannedShare: Number(project.plannedShare || 0)
  }));
}

function migrateAppName(nextState) {
  if (nextState.company?.company === LEGACY_APP_NAME) nextState.company.company = APP_NAME;
  nextState.users = (nextState.users || []).map((user) => ({
    ...user,
    orgs: (user.orgs || []).map((org) => (org === LEGACY_APP_NAME ? APP_NAME : org))
  }));
  nextState.projects = (nextState.projects || []).map((project) => ({
    ...project,
    owner: project.owner === LEGACY_APP_NAME ? APP_NAME : project.owner,
    org: project.org === LEGACY_APP_NAME ? APP_NAME : project.org
  }));
  return nextState;
}

function normalizeSupabaseConfig(config = {}) {
  const merged = {
    ...initialState.supabase,
    ...config
  };
  if (!merged.anonKey) merged.anonKey = initialState.supabase.anonKey;
  if (!merged.url) merged.url = initialState.supabase.url;
  return merged;
}

function applySupabaseParams() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get("url");
  const anonKey = params.get("anonKey") || params.get("publishableKey");
  const enabled = params.get("enabled");
  if (!url && !anonKey && enabled === null) return;

  state.supabase = normalizeSupabaseConfig({
    ...state.supabase,
    url: url || state.supabase.url,
    anonKey: anonKey || state.supabase.anonKey,
    enabled: enabled === null ? state.supabase.enabled : ["1", "true", "on", "yes"].includes(enabled.toLowerCase()),
    lastStatus: "Supabase settings loaded from the page URL."
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentUser() {
  return state.users.find((user) => user.id === state.activeUserId) || state.users[0];
}

function canViewProject(project) {
  const user = currentUser();
  if (!user || user.role === "admin") return true;
  const email = String(user.email || "").toLowerCase();
  const orgs = new Set((user.orgs || []).map((org) => String(org).toLowerCase()));
  const viewers = new Set((project.allowedViewers || []).map((viewer) => String(viewer).toLowerCase()));
  return orgs.has(String(project.org || "").toLowerCase()) || viewers.has(email);
}

function visibleProjects() {
  return state.projects.filter(canViewProject);
}

function scopedProjectIds() {
  const visibleIds = visibleProjects().map((project) => project.id);
  if (state.activeProjectId !== "all" && visibleIds.includes(state.activeProjectId)) return [state.activeProjectId];
  return visibleIds;
}

function scopedEntries(entries) {
  const ids = new Set(scopedProjectIds());
  return entries.filter((entry) => ids.has(entry.projectId));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getProject(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

function projectName(projectId) {
  return getProject(projectId)?.name || "Unknown project";
}

function approvalStatus(expense) {
  if (expense.projected) return "Projected";
  const a = expense.approvals?.partnerA === true;
  const b = expense.approvals?.partnerB === true;
  if (a && b) return "Approved";
  return "Pending";
}

function statusBadge(status) {
  const cls = status === "Approved" || status === "Paid" ? "approved" : status === "Pending" || status === "Invoice sent" || status === "Payment pending" || status === "Projected" ? "pending" : status === "Overdue" ? "blocked" : "";
  return `<span class="badge ${cls}">${status}</span>`;
}

function paidIncomeTotal(entries = state.income) {
  return entries
    .filter((entry) => entry.status === "Paid" || entry.status === "Partially paid")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function openIncomeEntries(entries = state.income) {
  return entries.filter((entry) => !["Paid", "Refunded", "Trial"].includes(entry.status));
}

function isOverdue(entry) {
  const today = new Date().toISOString().slice(0, 10);
  return entry.dueDate && openIncomeEntries([entry]).length > 0 && entry.dueDate < today;
}

function addAudit(action, detail, projectId = "") {
  state.audit.unshift({
    id: uid("audit"),
    at: new Date().toISOString(),
    actor: state.company.ceo || "User",
    action,
    detail,
    projectId
  });
  state.audit = state.audit.slice(0, 250);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

function normalizeVendor(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\b\d{2,}\b/g, "")
    .replace(/[*#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expenseImportKey(expense) {
  return [
    expense.projectId,
    expense.date,
    normalizeVendor(expense.vendor),
    Number(expense.amount).toFixed(2),
    expense.projected ? "projected" : "actual"
  ].join("|");
}

function entriesForReport() {
  const projectId = $("#report-project").value;
  const from = $("#report-from").value || START_DATE;
  const to = $("#report-to").value || "9999-12-31";
  const visibleIds = new Set(visibleProjects().map((project) => project.id));
  const match = (entry) =>
    visibleIds.has(entry.projectId) &&
    (projectId === "all" || entry.projectId === projectId) &&
    entry.date >= from &&
    entry.date <= to;

  return {
    projectId,
    from,
    to,
    timeEntries: state.timeEntries.filter(match),
    expenses: state.expenses.filter(match),
    income: state.income.filter(match),
    funds: state.funds.filter(match)
  };
}

function summarizeProject(projectId) {
  const timeEntries = state.timeEntries.filter((entry) => entry.projectId === projectId);
  const expenses = state.expenses.filter((entry) => entry.projectId === projectId);
  const income = state.income.filter((entry) => entry.projectId === projectId);
  const funds = state.funds.filter((entry) => entry.projectId === projectId);
  const hours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const labor = timeEntries.reduce((sum, entry) => sum + Number(entry.hours) * Number(entry.rate), 0);
  const expenseTotal = expenses.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const incomeTotal = paidIncomeTotal(income);
  const openTotal = openIncomeEntries(income).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const fundTotal = funds.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const activityTotal = labor + expenseTotal + fundTotal + incomeTotal + openTotal;

  return { hours, labor, expenseTotal, incomeTotal, openTotal, fundTotal, activityTotal, net: incomeTotal + fundTotal - expenseTotal };
}

function setProjectOptions() {
  const projects = visibleProjects();
  if (state.activeProjectId !== "all" && !projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = "all";
  }
  const hasProjects = projects.length > 0;
  const options = projects
    .map((project) => `<option value="${project.id}">${htmlEscape(project.name)}</option>`)
    .join("");
  ["#time-project", "#expense-project", "#income-project", "#fund-project", "#import-project"].forEach((selector) => {
    const select = $(selector);
    const selected = select.value;
    select.innerHTML = hasProjects ? options : `<option value="">Add an initiative first</option>`;
    select.disabled = !hasProjects;
    if (selected) select.value = selected;
  });

  const report = $("#report-project");
  const reportSelected = report.value || "all";
  report.innerHTML = `<option value="all">All initiatives</option>${options}`;
  report.value = [...projects.map((project) => project.id), "all"].includes(reportSelected) ? reportSelected : "all";

  const activeProject = $("#active-project");
  activeProject.innerHTML = `<option value="all">All visible initiatives</option>${options}`;
  activeProject.value = state.activeProjectId;

  $("#active-user").innerHTML = state.users
    .map((user) => `<option value="${user.id}">${htmlEscape(user.name)} (${htmlEscape(user.role)})</option>`)
    .join("");
  $("#active-user").value = state.activeUserId;

  ["#time-form button[type='submit']", "#expense-form button[type='submit']", "#income-form button[type='submit']", "#fund-form button[type='submit']", "#import-expenses"].forEach((selector) => {
    $(selector).disabled = !hasProjects;
  });
}

function setPaymentSourceOptions() {
  const source = $("#expense-form [name='source']");
  const selected = source.value;
  const values = [state.company.card, state.company.bank, "Founder reimbursement"].filter(Boolean);
  source.innerHTML = values.map((value) => `<option>${htmlEscape(value)}</option>`).join("");
  if (selected && values.includes(selected)) source.value = selected;
}

function renderSuggestions() {
  $("#vendor-suggestions").innerHTML = Object.keys(state.formMemory.vendors || {})
    .sort()
    .map((value) => `<option value="${htmlEscape(state.formMemory.vendors[value].display || value)}"></option>`)
    .join("");
  $("#customer-suggestions").innerHTML = Object.keys(state.formMemory.customers || {})
    .sort()
    .map((value) => `<option value="${htmlEscape(state.formMemory.customers[value].display || value)}"></option>`)
    .join("");
  $("#contributor-suggestions").innerHTML = Object.keys(state.formMemory.contributors || {})
    .sort()
    .map((value) => `<option value="${htmlEscape(value)}"></option>`)
    .join("");
}

function rememberVendor(data) {
  const key = normalizeVendor(data.vendor);
  if (!key) return;
  state.formMemory.vendors[key] = {
    display: data.vendor,
    category: data.category,
    source: data.source,
    purpose: data.purpose
  };
}

function rememberCustomer(data) {
  const key = String(data.customer || "").trim().toLowerCase();
  if (!key) return;
  state.formMemory.customers[key] = {
    display: data.customer,
    plan: data.plan,
    paymentMethod: data.paymentMethod,
    status: data.status
  };
}

function rememberContributor(data) {
  const key = String(data.contributor || "").trim();
  if (!key) return;
  state.formMemory.contributors[key] = {
    type: data.type,
    reference: data.reference
  };
}

function applyVendorMemory(vendor) {
  const memory = state.formMemory.vendors[normalizeVendor(vendor)];
  if (!memory) return;
  const form = $("#expense-form");
  if (memory.category) form.elements.category.value = memory.category;
  if (memory.source) form.elements.source.value = memory.source;
  if (memory.purpose && !form.elements.purpose.value) form.elements.purpose.value = memory.purpose;
}

function applyCustomerMemory(customer) {
  const memory = state.formMemory.customers[String(customer || "").trim().toLowerCase()];
  if (!memory) return;
  const form = $("#income-form");
  if (memory.plan) form.elements.plan.value = memory.plan;
  if (memory.paymentMethod) form.elements.paymentMethod.value = memory.paymentMethod;
  if (memory.status) form.elements.status.value = memory.status;
}

function applyContributorMemory(contributor) {
  const memory = state.formMemory.contributors[String(contributor || "").trim()];
  if (!memory) return;
  const form = $("#fund-form");
  if (memory.type) form.elements.type.value = memory.type;
  if (memory.reference && !form.elements.reference.value) form.elements.reference.value = memory.reference;
}

function selectProjectEverywhere(projectId) {
  if (!projectId) return;
  ["#time-project", "#expense-project", "#income-project", "#fund-project", "#import-project"].forEach((selector) => {
    const select = $(selector);
    if ([...select.options].some((option) => option.value === projectId)) select.value = projectId;
  });
  const project = getProject(projectId);
  if (project) $("#time-form [name='rate']").value = project.rate || 150;
}

function inferProjectFields() {
  const form = $("#project-form");
  const name = form.elements.name.value.trim();
  if (!name) return;
  if (!form.elements.org.value) form.elements.org.value = name;
  if (!form.elements.url.value && name.includes(".")) form.elements.url.value = name.toLowerCase();
  if (!form.elements.owner.value) form.elements.owner.value = state.company.company;
}

function defaultInvoiceDueDate() {
  const form = $("#income-form");
  if (!form.elements.date.value || form.elements.dueDate.value) return;
  const date = new Date(`${form.elements.date.value}T00:00:00`);
  date.setDate(date.getDate() + 30);
  form.elements.dueDate.value = date.toISOString().slice(0, 10);
}

function nextInvoiceNumber() {
  const prefix = state.company.invoicePrefix || "INV";
  return `${prefix}-${String(state.company.nextInvoiceNumber || 1).padStart(4, "0")}`;
}

function renderDashboard() {
  const visible = visibleProjects();
  const projectIds = new Set(scopedProjectIds());
  const timeEntries = state.timeEntries.filter((entry) => projectIds.has(entry.projectId));
  const expenses = state.expenses.filter((entry) => projectIds.has(entry.projectId));
  const income = state.income.filter((entry) => projectIds.has(entry.projectId));
  const funds = state.funds.filter((entry) => projectIds.has(entry.projectId));
  const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const totalLabor = timeEntries.reduce((sum, entry) => sum + Number(entry.hours) * Number(entry.rate), 0);
  const totalExpenses = expenses.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const totalIncome = paidIncomeTotal(income);
  const totalFunds = funds.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const openInvoices = openIncomeEntries(income);
  const openTotal = openInvoices.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const overdueCount = openInvoices.filter(isOverdue).length;
  const pending = expenses.filter((expense) => approvalStatus(expense) === "Pending");

  $("#metric-hours").textContent = `${totalHours.toFixed(1)} h`;
  $("#metric-labor").textContent = money(totalLabor);
  $("#metric-expenses").textContent = money(totalExpenses);
  $("#metric-pending").textContent = `${pending.length} pending approvals`;
  $("#metric-income").textContent = money(totalIncome);
  $("#metric-orders").textContent = `${income.length} invoices`;
  $("#metric-funds").textContent = money(totalFunds);
  $("#metric-fund-count").textContent = `${funds.length} contributions`;
  $("#metric-open").textContent = money(openTotal);
  $("#metric-overdue").textContent = `${overdueCount} overdue`;

  $("#project-summary-body").innerHTML = visible.length
    ? sortedProjects().filter((project) => projectIds.has(project.id))
        .map((project) => {
          const summary = summarizeProject(project.id);
          const largest = Math.max(...visible.map((item) => summarizeProject(item.id).activityTotal), 1);
          const width = summary.activityTotal ? Math.max(8, (summary.activityTotal / largest) * 100) : Number(project.plannedShare || 0);
          const focusLabel = summary.activityTotal ? "Actual allocation" : "Planned focus";
          return `<article class="allocation-item">
            <div class="allocation-main">
              <div>
                <strong>${htmlEscape(project.name)}</strong>
                <span>${htmlEscape(project.status)} · ${focusLabel} ${Math.round(width)}% · ${htmlEscape(project.url || project.owner)}</span>
              </div>
              <span class="badge">${summary.hours.toFixed(1)} h</span>
            </div>
            <div class="allocation-bar" aria-hidden="true"><span style="width:${width}%"></span></div>
            <div class="allocation-stats">
              <span>Labor ${money(summary.labor)}</span>
              <span>Expenses ${money(summary.expenseTotal)}</span>
              <span>Funds ${money(summary.fundTotal)}</span>
              <span>Paid ${money(summary.incomeTotal)}</span>
            </div>
          </article>`;
        })
        .join("")
    : `<div class="empty-state">Add your first real initiative to begin production tracking.</div>`;

  $("#approval-preview").innerHTML = pending.length
    ? pending
        .slice(0, 4)
        .map(
          (expense) => `<div class="item">
            <div class="item-title"><strong>${htmlEscape(expense.vendor)}</strong>${statusBadge("Pending")}</div>
            <span>${htmlEscape(projectName(expense.projectId))} · ${money(expense.amount)}</span>
            <span class="status-line">${htmlEscape(expense.purpose)}</span>
          </div>`
        )
        .join("")
    : `<div class="empty-state">No pending approvals. New card or bank spend will appear here.</div>`;

  renderControlChecks();
}

function sortedProjects() {
  return visibleProjects()
    .slice()
    .sort((a, b) => {
      const activityDelta = summarizeProject(b.id).activityTotal - summarizeProject(a.id).activityTotal;
      if (activityDelta !== 0) return activityDelta;
      return (Number(a.priority) || 99) - (Number(b.priority) || 99);
    });
}

function renderControlChecks() {
  const ids = new Set(scopedProjectIds());
  const expenses = state.expenses.filter((expense) => ids.has(expense.projectId));
  const pending = expenses.filter((expense) => approvalStatus(expense) === "Pending");
  const missingReceipts = expenses.filter((expense) => !expense.receipt);
  const overdueInvoices = openIncomeEntries(state.income.filter((entry) => ids.has(entry.projectId))).filter(isOverdue);
  const overBudget = visibleProjects().filter((project) => {
    if (!ids.has(project.id)) return false;
    const budget = Number(project.budget) || 0;
    if (!budget) return false;
    const summary = summarizeProject(project.id);
    return summary.expenseTotal + summary.labor > budget;
  });

  const checks = [
    { label: "Pending spend approvals", value: pending.length, tone: pending.length ? "pending" : "approved" },
    { label: "Expenses missing receipts", value: missingReceipts.length, tone: missingReceipts.length ? "pending" : "approved" },
    { label: "Overdue invoices", value: overdueInvoices.length, tone: overdueInvoices.length ? "blocked" : "approved" },
    { label: "Initiatives over budget", value: overBudget.length, tone: overBudget.length ? "blocked" : "approved" }
  ];

  $("#control-checks").innerHTML = checks
    .map(
      (check) => `<article class="control-check">
        <span>${htmlEscape(check.label)}</span>
        <strong>${check.value}</strong>
        <span class="badge ${check.tone}">${check.value ? "Review" : "Clear"}</span>
      </article>`
    )
    .join("");
}

function renderProjects() {
  const projects = visibleProjects();
  $("#project-list").innerHTML = projects.length
    ? projects
        .map((project) => {
          const summary = summarizeProject(project.id);
          const budget = Number(project.budget) > 0 ? ` · Budget ${money(project.budget)}` : "";
          return `<article class="item">
            <div class="item-title">
              <strong>${htmlEscape(project.name)}</strong>
              <span class="badge">${htmlEscape(project.status)}</span>
            </div>
            <span>${htmlEscape(project.owner)} · ${htmlEscape(project.org)}${project.url ? ` · ${htmlEscape(project.url)}` : ""}${budget}</span>
            <span class="status-line">Viewers: ${htmlEscape(viewerSummary(project))}</span>
            <span class="status-line">${summary.hours.toFixed(1)} hours · ${money(summary.labor)} labor value · ${money(summary.expenseTotal)} expenses · ${money(summary.openTotal)} open invoices</span>
          </article>`;
        })
        .join("")
    : `<div class="empty-state">No initiatives yet. Add OpusOT, OncoSafeRx.com, or any other real project when you are ready to track it.</div>`;
}

function renderTime() {
  const entries = scopedEntries(state.timeEntries);
  $("#time-body").innerHTML = entries.length
    ? entries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (entry) => `<tr>
            <td>${shortDate(entry.date)}</td>
            <td>${htmlEscape(projectName(entry.projectId))}</td>
            <td>${Number(entry.hours).toFixed(2)}</td>
            <td>${money(entry.rate)}</td>
            <td>${money(Number(entry.hours) * Number(entry.rate))}</td>
            <td>${htmlEscape(entry.notes)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6"><div class="empty-state">No time records yet.</div></td></tr>`;
}

function renderExpenses() {
  const entries = scopedEntries(state.expenses);
  $("#expense-body").innerHTML = entries.length
    ? entries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (expense) => `<tr>
            <td>${shortDate(expense.date)}</td>
            <td>${htmlEscape(projectName(expense.projectId))}</td>
            <td><strong>${htmlEscape(expense.vendor)}</strong><br><span class="status-line">${htmlEscape(expense.source)}</span></td>
            <td>${money(expense.amount)}</td>
            <td>${htmlEscape(expense.category)}</td>
            <td>${statusBadge(approvalStatus(expense))}</td>
            <td>${htmlEscape(expense.reference || expense.receipt || "")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="7"><div class="empty-state">No expenses yet.</div></td></tr>`;
}

function renderIncome() {
  const entries = scopedEntries(state.income);
  $("#income-body").innerHTML = entries.length
    ? entries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((entry) => {
          const status = isOverdue(entry) ? "Overdue" : entry.status;
          return `<tr>
            <td>${shortDate(entry.date)}</td>
            <td>${htmlEscape(projectName(entry.projectId))}</td>
            <td>${htmlEscape(entry.invoiceNumber || "")}</td>
            <td>${htmlEscape(entry.customer)}</td>
            <td>${htmlEscape(entry.plan)}</td>
            <td>${money(entry.amount)}</td>
            <td>${statusBadge(status)}</td>
            <td>${shortDate(entry.dueDate)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="8"><div class="empty-state">No invoices or payments yet.</div></td></tr>`;
}

function renderFunds() {
  const entries = scopedEntries(state.funds);
  $("#fund-body").innerHTML = entries.length
    ? entries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (entry) => `<tr>
            <td>${shortDate(entry.date)}</td>
            <td>${htmlEscape(projectName(entry.projectId))}</td>
            <td>${htmlEscape(entry.contributor)}</td>
            <td>${htmlEscape(entry.type)}</td>
            <td>${money(entry.amount)}</td>
            <td>${htmlEscape(entry.reference || "")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6"><div class="empty-state">No fund infusions yet.</div></td></tr>`;
}

function smsMessage(expense, partnerName) {
  const purpose = String(expense.purpose || "").replace(/[.?!\s]+$/, "");
  return `Approval requested: ${state.company.company} spend of ${money(expense.amount)} for ${expense.vendor} on ${projectName(expense.projectId)}. Purpose: ${purpose}. Please reply APPROVE or HOLD. - ${state.company.ceo}`;
}

function renderApprovals() {
  const ids = new Set(scopedProjectIds());
  const pending = state.expenses.filter((expense) => ids.has(expense.projectId) && approvalStatus(expense) === "Pending");
  $("#approval-list").innerHTML = pending.length
    ? pending
        .map((expense) => {
          const partnerAName = state.partners.partnerA;
          const partnerBName = state.partners.partnerB;
          return `<article class="approval-card">
            <div class="item-title">
              <div>
                <strong>${htmlEscape(expense.vendor)} · ${money(expense.amount)}</strong>
                <div class="status-line">${htmlEscape(projectName(expense.projectId))} · ${htmlEscape(expense.category)} · ${shortDate(expense.date)}</div>
              </div>
              ${statusBadge(approvalStatus(expense))}
            </div>
            <div class="sms-text">${htmlEscape(smsMessage(expense))}</div>
            <div class="approval-grid">
              ${approvalPerson(expense, "partnerA", partnerAName, state.partners.phoneA)}
              ${approvalPerson(expense, "partnerB", partnerBName, state.partners.phoneB)}
              <div class="approval-person">
                <strong>Documentation</strong>
                <span class="status-line">${htmlEscape(expense.reference || "No invoice or quote reference")}</span>
                <span class="status-line">${htmlEscape(expense.receipt || "No receipt reference yet")}</span>
                <span class="status-line">${htmlEscape(expense.source)}</span>
              </div>
            </div>
          </article>`;
        })
        .join("")
    : `<div class="empty-state">No pending spend approvals. Fully approved expenses remain in the expense ledger.</div>`;
}

function approvalPerson(expense, key, name, phone) {
  const approved = expense.approvals?.[key] === true;
  const message = encodeURIComponent(smsMessage(expense, name));
  const smsHref = phone ? `sms:${encodeURIComponent(phone)}?&body=${message}` : "#";
  return `<div class="approval-person">
    <strong>${htmlEscape(name)}</strong>
    <span class="badge ${approved ? "approved" : "pending"}">${approved ? "Approved" : "Waiting"}</span>
    <div class="approval-actions">
      <a class="secondary-button" href="${smsHref}" ${phone ? "" : 'aria-disabled="true"'}>SMS</a>
      <button class="primary-button" data-approve="${expense.id}" data-partner="${key}" type="button">${approved ? "Keep" : "Approve"}</button>
    </div>
  </div>`;
}

function renderReport() {
  const data = entriesForReport();
  const title = data.projectId === "all" ? "All initiatives" : projectName(data.projectId);
  const labor = data.timeEntries.reduce((sum, entry) => sum + Number(entry.hours) * Number(entry.rate), 0);
  const hours = data.timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const expenses = data.expenses.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const income = paidIncomeTotal(data.income);
  const open = openIncomeEntries(data.income).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const funds = data.funds.reduce((sum, entry) => sum + Number(entry.amount), 0);
  $("#report-title").textContent = title;

  $("#report-content").innerHTML = `
    <div class="metric-grid">
      <article class="metric"><span>Period</span><strong>${shortDate(data.from)}</strong><p>through ${shortDate(data.to)}</p></article>
      <article class="metric"><span>Labor investment</span><strong>${money(labor)}</strong><p>${hours.toFixed(1)} founder hours</p></article>
      <article class="metric"><span>Expenses</span><strong>${money(expenses)}</strong><p>${data.expenses.length} receipts/items</p></article>
      <article class="metric"><span>Funds</span><strong>${money(funds)}</strong><p>${data.funds.length} contributions</p></article>
      <article class="metric"><span>Paid</span><strong>${money(income)}</strong><p>${data.income.length} invoices</p></article>
      <article class="metric"><span>Open A/R</span><strong>${money(open)}</strong><p>${openIncomeEntries(data.income).filter(isOverdue).length} overdue</p></article>
    </div>
    ${reportTable("Time records", ["Date", "Project", "Hours", "Rate", "Value", "Work"], data.timeEntries.map((entry) => [shortDate(entry.date), projectName(entry.projectId), Number(entry.hours).toFixed(2), money(entry.rate), money(Number(entry.hours) * Number(entry.rate)), entry.notes]))}
    ${reportTable("Expenses and receipts", ["Date", "Project", "Vendor", "Amount", "Reference", "Receipt", "Approval"], data.expenses.map((entry) => [shortDate(entry.date), projectName(entry.projectId), entry.vendor, money(entry.amount), entry.reference || "", entry.receipt || "Pending receipt", approvalStatus(entry)]))}
    ${reportTable("Fund infusions", ["Date", "Project", "Contributor", "Type", "Amount", "Reference"], data.funds.map((entry) => [shortDate(entry.date), projectName(entry.projectId), entry.contributor, entry.type, money(entry.amount), entry.reference || ""]))}
    ${reportTable("Invoices and payments", ["Date", "Due", "Project", "Invoice", "Customer", "Plan", "Amount", "Status"], data.income.map((entry) => [shortDate(entry.date), shortDate(entry.dueDate), projectName(entry.projectId), entry.invoiceNumber || "", entry.customer, entry.plan, money(entry.amount), isOverdue(entry) ? "Overdue" : entry.status]))}
  `;
  renderMonthlyReports(data);
}

function renderMonthlyReports(data) {
  const months = {};
  data.expenses.forEach((expense) => {
    const key = monthKey(expense.date);
    if (!months[key]) months[key] = { actual: 0, recurring: 0, count: 0, missingReceipts: 0 };
    months[key].count += 1;
    if (expense.projected || expense.recurring) months[key].recurring += Number(expense.amount);
    else months[key].actual += Number(expense.amount);
    if (!expense.receipt) months[key].missingReceipts += 1;
  });

  const rows = Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [
      key,
      item.count,
      money(item.actual),
      money(item.recurring),
      money(item.actual + item.recurring),
      item.missingReceipts
    ]);

  $("#monthly-report-content").innerHTML = reportTable("Monthly expense reports", ["Month", "Charges", "Actual", "Recurring / projected", "Total", "Missing receipts"], rows);
}

function reportTable(title, headers, rows) {
  if (!rows.length) {
    return `<div class="report-block"><h3>${title}</h3><div class="empty-state">No records in this period.</div></div>`;
  }

  return `<div class="report-block">
    <h3>${title}</h3>
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  </div>`;
}

function renderAudit() {
  const ids = new Set(scopedProjectIds());
  const entries = state.audit.filter((entry) => !entry.projectId || ids.has(entry.projectId));
  $("#audit-list").innerHTML = entries.length
    ? entries
        .map(
          (entry) => `<article class="item">
            <div class="item-title">
              <strong>${htmlEscape(entry.action)}</strong>
              <span class="badge">${new Date(entry.at).toLocaleString()}</span>
            </div>
            <span>${htmlEscape(entry.detail)}</span>
            <span class="status-line">${htmlEscape(entry.actor)}</span>
          </article>`
        )
        .join("")
    : `<div class="empty-state">No audit events visible for this profile and initiative.</div>`;
}

function viewerSummary(project) {
  if (currentUser()?.role === "admin") {
    const explicit = (project.allowedViewers || []).join(", ");
    return explicit ? `${project.org}; ${explicit}` : project.org;
  }
  return `Visible through ${project.org}`;
}

function renderUsers() {
  $("#user-list").innerHTML = state.users
    .map(
      (user) => `<article class="item">
        <div class="item-title">
          <strong>${htmlEscape(user.name)}</strong>
          <span class="badge">${htmlEscape(user.role)}</span>
        </div>
        <span>${htmlEscape(user.email)}</span>
        <span class="status-line">${htmlEscape((user.orgs || []).join(", ") || "No orgs")}</span>
      </article>`
    )
    .join("");
}

function renderSettings() {
  Object.entries(state.company).forEach(([key, value]) => {
    $(`#company-form [name="${key}"]`).value = value;
  });
  Object.entries(state.partners).forEach(([key, value]) => {
    $(`#partner-form [name="${key}"]`).value = value;
  });
  $("#supabase-form [name='url']").value = state.supabase.url || "";
  $("#supabase-form [name='anonKey']").value = state.supabase.anonKey || "";
  $("#supabase-form [name='enabled']").checked = Boolean(state.supabase.enabled);
  $("#supabase-status").textContent = state.supabase.lastStatus || `Project ID: ${state.supabase.projectId}`;
}

function renderAll() {
  setProjectOptions();
  setPaymentSourceOptions();
  renderSuggestions();
  if (state.activeProjectId !== "all") selectProjectEverywhere(state.activeProjectId);
  const selectedProject = $("#time-project").value;
  const rate = selectedProject ? getProject(selectedProject)?.rate : state.projects[0]?.rate;
  if (!$("#time-form [name='rate']").value) $("#time-form [name='rate']").value = rate || 150;
  $("#invoice-number").placeholder = nextInvoiceNumber();
  renderDashboard();
  renderProjects();
  renderTime();
  renderExpenses();
  renderIncome();
  renderFunds();
  renderApprovals();
  renderReport();
  renderAudit();
  renderSettings();
  renderUsers();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function columnIndex(ref) {
  const letters = String(ref || "").replace(/[^A-Z]/gi, "").toUpperCase();
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function unzipXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Could not find XLSX directory.");

  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const files = {};

  for (let i = 0; i < entries; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid XLSX directory.");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decodeBytes(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const content = method === 8 ? await inflateRaw(compressed) : compressed;
    files[name] = decodeBytes(content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function parseSharedStrings(xmlText) {
  if (!xmlText) return [];
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((node) => node.textContent || "")
      .join("")
  );
}

function excelSerialToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return "";
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Math.floor(serial));
  return date.toISOString().slice(0, 10);
}

function parseSheetXml(xmlText, sharedStrings) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  return Array.from(doc.getElementsByTagName("row")).map((rowNode) => {
    const row = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cellNode) => {
      const index = columnIndex(cellNode.getAttribute("r"));
      const type = cellNode.getAttribute("t");
      let value = "";
      if (type === "inlineStr") {
        value = Array.from(cellNode.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
      } else {
        value = cellNode.getElementsByTagName("v")[0]?.textContent || "";
        if (type === "s") value = sharedStrings[Number(value)] || "";
      }
      row[index] = value;
    });
    return row.map((value) => value ?? "");
  });
}

async function parseXlsx(file) {
  const files = await unzipXlsx(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const workbook = new DOMParser().parseFromString(files["xl/workbook.xml"], "application/xml");
  const firstSheet = workbook.getElementsByTagName("sheet")[0];
  if (!firstSheet) throw new Error("No worksheets found.");
  const relId = firstSheet.getAttribute("r:id");
  const rels = new DOMParser().parseFromString(files["xl/_rels/workbook.xml.rels"], "application/xml");
  const rel = Array.from(rels.getElementsByTagName("Relationship")).find((item) => item.getAttribute("Id") === relId);
  const target = rel?.getAttribute("Target") || "worksheets/sheet1.xml";
  const sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
  return parseSheetXml(files[sheetPath] || files["xl/worksheets/sheet1.xml"], sharedStrings);
}

async function parseImportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(file);
  const text = await file.text();
  return parseCsv(text, name.endsWith(".tsv") ? "\t" : ",");
}

function parseDateValue(value, header = "") {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) {
    const [month, day, year] = text.split("/").map(Number);
    const fullYear = year < 100 ? 2000 + year : year;
    return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/date/i.test(header) && Number(text) > 30000) return excelSerialToIso(text);
  return "";
}

function normalizeImportedRows(rows, projectId, fileName) {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /transaction|date/i.test(String(cell))) &&
    row.some((cell) => /description|vendor|merchant|payee/i.test(String(cell))) &&
    row.some((cell) => /amount|charge|debit/i.test(String(cell)))
  );
  if (headerIndex < 0) throw new Error("Could not find date, description, and amount columns.");

  const headers = rows[headerIndex].map((header) => String(header || "").trim());
  const findColumn = (patterns) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  const dateCol = findColumn([/transaction.*date/i, /^date$/i, /posted/i]);
  const vendorCol = findColumn([/description/i, /vendor/i, /merchant/i, /payee/i]);
  const categoryCol = findColumn([/category/i, /type/i]);
  const amountCol = findColumn([/amount/i, /charge/i, /debit/i]);

  return rows
    .slice(headerIndex + 1)
    .map((row) => {
      const rawAmount = Number(String(row[amountCol] || "").replace(/[$,()]/g, "").trim());
      const amount = Math.abs(rawAmount);
      const date = parseDateValue(row[dateCol], headers[dateCol]);
      const vendor = String(row[vendorCol] || "").trim();
      return {
        id: uid("expense"),
        projectId,
        vendor,
        amount,
        date,
        category: String(row[categoryCol] || "Imported").trim() || "Imported",
        source: "Spreadsheet import",
        reference: fileName,
        receipt: "",
        purpose: `Imported charge: ${vendor}`,
        approvals: { partnerA: true, partnerB: true },
        imported: true,
        recurring: false,
        projected: false
      };
    })
    .filter((expense) => expense.date >= START_DATE && expense.date <= todayIso() && expense.vendor && expense.amount > 0);
}

function detectRecurringExpenses(expenses, projectId, fileName) {
  const groups = new Map();
  expenses.forEach((expense) => {
    const key = normalizeVendor(expense.vendor);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(expense);
  });

  const projected = [];
  const detected = [];
  const startMonth = new Date(`${START_DATE}T00:00:00`);
  const endMonth = new Date(`${todayIso().slice(0, 7)}-01T00:00:00`);

  groups.forEach((items, key) => {
    const months = new Set(items.map((item) => monthKey(item.date)));
    if (months.size < 2 && items.length < 2) return;
    detected.push(key);
    const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const day = Math.min(28, Number(latest.date.slice(8, 10)) || 1);
    const amounts = sorted.map((item) => Number(item.amount)).sort((a, b) => a - b);
    const amount = amounts[Math.floor(amounts.length / 2)];
    const category = latest.category || "Recurring";

    for (let cursor = new Date(startMonth); cursor <= endMonth; cursor.setMonth(cursor.getMonth() + 1)) {
      const keyMonth = cursor.toISOString().slice(0, 7);
      if (months.has(keyMonth)) continue;
      const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const date = `${keyMonth}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
      if (date > todayIso()) continue;
      projected.push({
        id: uid("expense"),
        projectId,
        vendor: latest.vendor,
        amount,
        date,
        category,
        source: "Recurring expense projection",
        reference: `${fileName} · AI recurring detector`,
        receipt: "",
        purpose: `Projected recurring charge based on ${sorted.length} prior ${latest.vendor} charges.`,
        approvals: { partnerA: true, partnerB: true },
        imported: true,
        recurring: true,
        projected: true
      });
    }
  });

  return { detected, projected };
}

async function importExpensesFromFile() {
  const file = $("#expense-import-file").files[0];
  const projectId = $("#import-project").value;
  const mode = $("#import-mode").value;
  if (!file || !projectId) {
    $("#import-summary").innerHTML = `<div class="empty-state">Choose a project and spreadsheet first.</div>`;
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const actuals = normalizeImportedRows(rows, projectId, file.name);
    const recurring = detectRecurringExpenses(actuals, projectId, file.name);
    const existing = new Set(state.expenses.map(expenseImportKey));
    const toImport = [];
    if (mode !== "recurring-only") toImport.push(...actuals);
    if (mode !== "actual-only") toImport.push(...recurring.projected);

    const deduped = toImport.filter((expense) => {
      const key = expenseImportKey(expense);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    state.expenses.push(...deduped);
    state.activeProjectId = projectId;
    deduped.filter((expense) => !expense.projected).forEach(rememberVendor);
    addAudit(
      "Spreadsheet imported",
      `${deduped.length} expenses imported for ${projectName(projectId)} from ${file.name}; ${recurring.detected.length} recurring vendors detected.`
      ,
      projectId
    );
    saveState();
    renderAll();

    const actualCount = deduped.filter((expense) => !expense.projected).length;
    const projectedCount = deduped.filter((expense) => expense.projected).length;
    $("#import-summary").innerHTML = `<div class="summary-strip">
      <span class="badge approved">${actualCount} actual charges</span>
      <span class="badge pending">${projectedCount} recurring projections</span>
      <span class="badge">${recurring.detected.length} recurring vendors</span>
      <span class="badge">${toImport.length - deduped.length} duplicates skipped</span>
    </div>`;
  } catch (error) {
    $("#import-summary").innerHTML = `<div class="empty-state">${htmlEscape(error.message || "Import failed.")}</div>`;
  }
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const data = entriesForReport();
  const rows = [["type", "date", "due_date", "project", "counterparty", "reference", "category_or_plan", "amount", "status_or_notes"]];
  data.timeEntries.forEach((entry) => rows.push(["time", entry.date, "", projectName(entry.projectId), state.company.ceo, "", "Founder labor", Number(entry.hours) * Number(entry.rate), entry.notes]));
  data.expenses.forEach((entry) => rows.push(["expense", entry.date, entry.neededBy || "", projectName(entry.projectId), entry.vendor, entry.reference || entry.receipt || "", entry.category, entry.amount, approvalStatus(entry)]));
  data.funds.forEach((entry) => rows.push(["fund", entry.date, "", projectName(entry.projectId), entry.contributor, entry.reference || "", entry.type, entry.amount, entry.notes || ""]));
  data.income.forEach((entry) => rows.push(["invoice", entry.date, entry.dueDate || "", projectName(entry.projectId), entry.customer, entry.invoiceNumber || "", entry.plan, entry.amount, isOverdue(entry) ? "Overdue" : entry.status]));
  download("useful-apps-report.csv", rows.map((row) => row.map(csvEscape).join(",")).join("\n"), "text/csv");
}

function exportJson() {
  download("useful-apps-report.json", JSON.stringify(entriesForReport(), null, 2), "application/json");
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  $$('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = input.min || today;
  });
  $("#report-to").value = today;
}

function wireEvents() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-button").forEach((nav) => nav.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.view}-view`).classList.add("active");
      $("#view-title").textContent = button.textContent;
    });
  });

  $("#project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.projects.push({
      id: uid("project"),
      ...data,
      allowedViewers: splitList(data.allowedViewers),
      rate: Number(data.rate),
      budget: Number(data.budget) || 0,
      priority: state.projects.length + 1,
      plannedShare: 0
    });
    addAudit("Initiative added", `${data.name} was created as a separate ledger.`, state.projects[state.projects.length - 1].id);
    saveState();
    event.currentTarget.reset();
    renderAll();
  });

  $("#time-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    if (data.date < START_DATE) {
      alert("Time tracking starts on March 1, 2026.");
      return;
    }
    state.timeEntries.push({ id: uid("time"), ...data, hours: Number(data.hours), rate: Number(data.rate) });
    state.activeProjectId = data.projectId;
    addAudit("Time recorded", `${Number(data.hours).toFixed(2)} hours recorded for ${projectName(data.projectId)}.`, data.projectId);
    saveState();
    event.currentTarget.reset();
    setTodayDefaults();
    renderAll();
  });

  $("#expense-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.expenses.push({
      id: uid("expense"),
      ...data,
      amount: Number(data.amount),
      approvals: { partnerA: false, partnerB: false }
    });
    state.activeProjectId = data.projectId;
    rememberVendor(data);
    addAudit("Spend requested", `${money(data.amount)} requested for ${data.vendor} on ${projectName(data.projectId)}.`, data.projectId);
    saveState();
    event.currentTarget.reset();
    setTodayDefaults();
    renderAll();
  });

  $("#income-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const invoiceNumber = data.invoiceNumber || nextInvoiceNumber();
    state.income.push({ id: uid("income"), ...data, invoiceNumber, amount: Number(data.amount) });
    if (!data.invoiceNumber) state.company.nextInvoiceNumber = Number(state.company.nextInvoiceNumber || 1) + 1;
    state.activeProjectId = data.projectId;
    rememberCustomer(data);
    addAudit("Invoice saved", `${invoiceNumber} saved for ${data.customer} at ${money(data.amount)}.`, data.projectId);
    saveState();
    event.currentTarget.reset();
    setTodayDefaults();
    renderAll();
  });

  $("#fund-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.funds.push({ id: uid("fund"), ...data, amount: Number(data.amount) });
    state.activeProjectId = data.projectId;
    rememberContributor(data);
    addAudit("Funds infused", `${money(data.amount)} recorded for ${projectName(data.projectId)} from ${data.contributor}.`, data.projectId);
    saveState();
    event.currentTarget.reset();
    setTodayDefaults();
    renderAll();
  });

  $("#approval-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-approve]");
    if (!button) return;
    const expense = state.expenses.find((entry) => entry.id === button.dataset.approve);
    if (!expense) return;
    expense.approvals[button.dataset.partner] = true;
    const partnerName = button.dataset.partner === "partnerA" ? state.partners.partnerA : state.partners.partnerB;
    addAudit("Spend approved", `${partnerName} approved ${money(expense.amount)} for ${expense.vendor}.`, expense.projectId);
    saveState();
    renderAll();
  });

  $("#time-project").addEventListener("change", (event) => {
    $("#time-form [name='rate']").value = getProject(event.target.value)?.rate || 150;
    state.activeProjectId = event.target.value;
    saveState();
    renderAll();
  });

  ["#expense-project", "#income-project", "#fund-project", "#import-project"].forEach((selector) => {
    $(selector).addEventListener("change", (event) => {
      state.activeProjectId = event.target.value;
      saveState();
      renderAll();
    });
  });

  $("#active-project").addEventListener("change", (event) => {
    state.activeProjectId = event.target.value;
    saveState();
    renderAll();
  });

  $("#active-user").addEventListener("change", (event) => {
    state.activeUserId = event.target.value;
    state.activeProjectId = "all";
    saveState();
    renderAll();
  });

  $("#expense-form [name='vendor']").addEventListener("change", (event) => applyVendorMemory(event.target.value));
  $("#expense-form [name='vendor']").addEventListener("blur", (event) => applyVendorMemory(event.target.value));
  $("#income-form [name='customer']").addEventListener("change", (event) => applyCustomerMemory(event.target.value));
  $("#income-form [name='customer']").addEventListener("blur", (event) => applyCustomerMemory(event.target.value));
  $("#income-form [name='date']").addEventListener("change", defaultInvoiceDueDate);
  $("#fund-form [name='contributor']").addEventListener("change", (event) => applyContributorMemory(event.target.value));
  $("#fund-form [name='contributor']").addEventListener("blur", (event) => applyContributorMemory(event.target.value));
  $("#project-form [name='name']").addEventListener("blur", inferProjectFields);
  $("#project-form [name='name']").addEventListener("change", inferProjectFields);

  $("#company-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.company = {
      ...state.company,
      ...data,
      approvalThreshold: Number(data.approvalThreshold) || 0,
      nextInvoiceNumber: Number(data.nextInvoiceNumber) || 1
    };
    addAudit("Company settings updated", "Company controls were updated.");
    saveState();
    renderAll();
  });

  $("#partner-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.partners = { ...state.partners, ...formData(event.currentTarget) };
    addAudit("Partner settings updated", "Approval contacts were updated.");
    saveState();
    renderAll();
  });

  $("#supabase-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    state.supabase = {
      ...state.supabase,
      url: data.url,
      anonKey: data.anonKey || state.supabase.anonKey,
      enabled: event.currentTarget.elements.enabled.checked,
      lastStatus: event.currentTarget.elements.enabled.checked ? "Supabase sync enabled." : "Supabase sync disabled."
    };
    addAudit("Supabase settings updated", `Database project ${state.supabase.projectId} configured.`);
    saveState();
    renderAll();
  });

  $("#load-supabase").addEventListener("click", loadStateFromSupabase);
  $("#push-supabase").addEventListener("click", () => pushStateToSupabase());

  $("#user-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const user = {
      id: uid("user"),
      name: data.name,
      email: data.email,
      orgs: splitList(data.orgs),
      role: data.role
    };
    state.users.push(user);
    addAudit("Access profile added", `${data.name} can view ${user.orgs.join(", ") || "explicitly assigned initiatives"}.`);
    saveState();
    event.currentTarget.reset();
    renderAll();
  });

  ["#report-project", "#report-from", "#report-to"].forEach((selector) => {
    $(selector).addEventListener("change", renderReport);
  });

  $("#export-csv").addEventListener("click", exportCsv);
  $("#export-json").addEventListener("click", exportJson);
  $("#import-expenses").addEventListener("click", importExpensesFromFile);
  $("#print-button").addEventListener("click", () => {
    $(".nav-button[data-view='reports']").click();
    window.print();
  });
}

applySupabaseParams();
setTodayDefaults();
wireEvents();
renderAll();
