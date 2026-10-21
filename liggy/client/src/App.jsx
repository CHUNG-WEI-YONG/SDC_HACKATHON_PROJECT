
import { useEffect, useState } from "react";
import "./style.css";

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [page, setPage] = useState("Overview");
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [businessDataLoaded, setBusinessDataLoaded] = useState(false);
  const [invoice, setInvoice] = useState({
    invoiceNo: "",
    seller: "",
    buyer: "",
    buyerId: "",
    buyerEmail: "",
    date: new Date().toISOString().slice(0, 10),
    currency: "MYR",
    tax: "0",
    notes: "",
  });
  const [invoiceItems, setInvoiceItems] = useState([{ description: "", quantity: 1, unit_price: "" }]);
  const [agentReview, setAgentReview] = useState(null);
  const [agentDecision, setAgentDecision] = useState("");
  const [agentPdf, setAgentPdf] = useState(null);
  const [emailPrompt, setEmailPrompt] = useState(null);
  const [emailOutcome, setEmailOutcome] = useState("");
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalSalesDisplay = formatCurrencyTotals(invoiceHistory);

  async function refreshBusinessData() {
    const response = await fetch("/api/business-data");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load business records.");
    setCustomers(data.customers || []);
    setInvoiceHistory(data.invoices || []);
    setSales((data.invoices || []).map((record) => ({
      id: record.invoice_no,
      invoiceNo: record.invoice_no,
      item: (record.invoice_data?.items || []).map((item) => item.description).join(", ") || "Invoice",
      customer: record.customer_name,
      amount: Number(record.total_amount || 0),
      currency: record.invoice_data?.currency || "MYR",
      status: record.status || "Approved",
      date: record.invoice_date || record.created_at,
    })));
    setBusinessDataLoaded(true);
    return data;
  }

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      const data = await response.json();
      if (response.ok) setUser(data.user);
    }).catch(() => {}).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    setError("");
    refreshBusinessData().catch((err) => {
      setError(err.message);
      setBusinessDataLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !["Daily Sales Report", "Monthly Insights"].includes(page)) return;
    setReport(buildSalesReport(invoiceHistory, page === "Daily Sales Report" ? "daily" : "monthly"));
  }, [page, invoiceHistory, user]);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const response = await fetch(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      setUser(data.user);
      setPage("Overview");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCustomers([]);
    setInvoiceHistory([]);
    setSales([]);
    setBusinessDataLoaded(false);
    setAgentReview(null);
    setAgentPdf(null);
    setEmailPrompt(null);
    setChatMessages([]);
  }

  async function createInvoice(event) {
    event.preventDefault();
    setError("");
    setEmailOutcome("");
    setLoading(true);

    try {
      const response = await fetch("/api/invoices/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoicePayload()),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate invoice.");
      }

      setAgentReview(data);
      useExtractedInvoice(data.state);
      setAgentDecision("");
      setAgentPdf(null);
      setEmailPrompt(null);
    } catch (err) {
      setError(
        err.message.includes("fetch")
          ? "Cannot connect to the backend. Make sure your server is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function invoicePayload() {
    return {
      invoice_no: invoice.invoiceNo,
      seller_name: invoice.seller,
      customer_name: invoice.buyer,
      customer_tin: invoice.buyerId,
      customer_email: invoice.buyerEmail,
      invoice_date: invoice.date,
      tax: Number(invoice.tax || 0),
      notes: invoice.notes,
      currency: invoice.currency,
      items: invoiceItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    };
  }

  function useExtractedInvoice(state) {
    const data = state?.invoice_data || {};
    const items = data.items?.length ? data.items : [{ description: "", quantity: 1, unit_price: "" }];
    setInvoice({
      invoiceNo: data.invoice_no || "",
      seller: data.seller_name || "",
      buyer: data.customer_name || "",
      buyerId: data.customer_tin || "",
      buyerEmail: data.customer_email || "",
      date: data.invoice_date || new Date().toISOString().slice(0, 10),
      currency: data.currency || "MYR",
      tax: data.tax ?? "0",
      notes: data.notes || "",
    });
    setInvoiceItems(items.map((item) => ({
      description: item.description || "",
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? "",
    })));
  }

  function updateBuyerName(name) {
    const match = customers.find((customer) => customer.customer_name.toLowerCase() === name.trim().toLowerCase());
    setInvoice((previous) => ({
      ...previous,
      buyer: name,
      ...(match ? { buyerEmail: match.email || "", buyerId: match.tin_number || "" } : {}),
    }));
  }

  async function analyzeInvoice(event) {
    event.preventDefault();
    if (!invoiceFile) {
      setError("Choose an invoice document to upload.");
      return;
    }
    setError("");
    setAgentReview(null);
    setAgentDecision("");
    setAgentPdf(null);
    setLoading(true);

    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Unable to read the selected file."));
        reader.readAsDataURL(invoiceFile);
      });
      const response = await fetch("/api/invoices/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: invoiceFile.name, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to analyze invoice.");
      setAgentReview(data);
      useExtractedInvoice(data.state);
      setAgentDecision("");
      setAgentPdf(null);
      setEmailPrompt(null);
    } catch (err) {
      setError(err.message.includes("fetch")
        ? "Cannot connect to the backend. Make sure the Liggy server and Python invoice agent are running."
        : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function decideInvoice(decision) {
    if (!agentReview?.thread_id) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/invoices/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: agentReview.thread_id, invoiceData: invoicePayload() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save invoice decision.");
      setAgentDecision(data.message || data.status);
      if (data.preview_url && data.download_url) {
        setAgentPdf({ previewUrl: data.preview_url, downloadUrl: data.download_url });
      }
      if (decision === "approve") {
        setEmailPrompt({ invoiceNo: data.invoice_no, email: data.customer_email || "" });
        setEmailOutcome("");
        await refreshBusinessData();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendInvoiceEmail() {
    if (!emailPrompt?.invoiceNo) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(emailPrompt.invoiceNo)}/send`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send this invoice.");
      setEmailOutcome(data.message || "Invoice email sent.");
      setEmailPrompt(null);
      await refreshBusinessData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport(type) {
    setError("");
    setReport(null);
    setLoading(true);

    try {
      const data = await refreshBusinessData();
      setReport(buildSalesReport(data.invoices || [], type));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages((previous) => [...previous, { role: "user", text: message }]);
    setChatBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: chatMessages.slice(-8).map(({ role, text }) => ({ role, content: text })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Liggy Help could not respond.");
      setChatMessages((previous) => [...previous, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setChatMessages((previous) => [...previous, { role: "assistant", text: err.message }]);
    } finally {
      setChatBusy(false);
    }
  }

  const navItems = [
    { name: "Overview", icon: "◫" },
    { name: "E-Invoice", icon: "▤" },
    { name: "Customers", icon: "♙" },
    { name: "Invoice History", icon: "▧" },
    { name: "Daily Sales Report", icon: "▥" },
    { name: "Monthly Insights", icon: "◷" },
    { name: "Liggy AI", icon: "✦" },
  ];
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthKey = todayKey.slice(0, 7);
  const todayInvoices = invoiceHistory.filter((record) => (record.invoice_date || record.created_at || "").slice(0, 10) === todayKey);
  const monthInvoices = invoiceHistory.filter((record) => (record.invoice_date || record.created_at || "").startsWith(monthKey));

  if (!authReady) return <div className="auth-screen"><div className="auth-card">Loading Liggy…</div></div>;
  if (!user) return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="brand auth-brand"><div className="brand-icon">L</div><span>liggy</span></div>
        <p className="eyebrow">YOUR PRIVATE BUSINESS WORKSPACE</p>
        <h1>{authMode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">Your customers, invoices, and reports belong to your account.</p>
        {authMode === "register" && <label className="field"><span>Username</span><input required minLength="2" maxLength="60" autoComplete="username" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} /></label>}
        <label className="field"><span>Email</span><input required type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
        <label className="field"><span>Password</span><input required type="password" minLength="8" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></label>
        {authError && <p className="error-banner">{authError}</p>}
        <button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}</button>
        <p className="auth-switch">{authMode === "register" ? "Already have an account?" : "New to Liggy?"} <button type="button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }}> {authMode === "register" ? "Sign in" : "Create account"}</button></p>
      </form>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">L</div>
          <span>liggy</span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => {
                setPage(item.name);
                setError("");
                setReport(null);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-status">
            <span className="status-dot" />
            <div>
              <strong>Liggy AI</strong>
              <small>Business assistant</small>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">{(user.username || "U").slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.username}</strong>
              <small>{user.email}</small>
            </div>
            <button className="sign-out-button" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace / {page}</div>
          <div className="topbar-right">
            <span className="today-date">
              {new Date().toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <div className="avatar">B</div>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {page === "Overview" && (
            <>
              <section className="welcome-section">
                <div>
                  <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
                  <h1>Good day, Business Owner 👋</h1>
                  <p className="muted">
                    Keep your sales, invoices and business insights in one place.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setPage("E-Invoice")}
                >
                  + Create e-invoice
                </button>
              </section>

              <section className="stats-grid">
                <StatCard
                  label="All-time Invoiced"
                  value={totalSalesDisplay || "MYR 0.00"}
                  note={`${invoiceHistory.length} invoices saved`}
                  icon="↗"
                />
                <StatCard
                  label="This Month"
                  value={formatCurrencyTotals(monthInvoices) || "MYR 0.00"}
                  note="Approved invoice value"
                  icon="✓"
                />
                <StatCard
                  label="Saved Invoices"
                  value={String(invoiceHistory.length)}
                  note="Historical invoice records"
                  icon="▤"
                />
                <StatCard
                  label="Customers"
                  value={String(customers.length)}
                  note="Saved in customer records"
                  icon="◷"
                />
              </section>

              <section className="dashboard-grid">
                <div className="panel transactions-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent Transactions</h2>
                      <p className="muted">Your latest approved e-invoices</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Daily Sales Report")}
                    >
                      View report →
                    </button>
                  </div>

                  <TransactionTable sales={sales.slice(-5).reverse()} />
                </div>

                <div className="panel quick-panel">
                  <h2>Quick Actions</h2>
                  <p className="muted">What would you like to do?</p>

                  <QuickAction
                    icon="▤"
                    title="Create E-Invoice"
                    description="Prepare a customer invoice"
                    onClick={() => setPage("E-Invoice")}
                  />
                  <QuickAction
                    icon="▥"
                    title="Daily Sales Report"
                    description="Review today's transactions"
                    onClick={() => setPage("Daily Sales Report")}
                  />
                  <QuickAction
                    icon="◷"
                    title="Monthly Insights"
                    description="Understand business performance"
                    onClick={() => setPage("Monthly Insights")}
                  />
                  <QuickAction icon="♙" title="Customer Records" description="See each customer's invoice spend" onClick={() => setPage("Customers")} />
                  <QuickAction icon="▧" title="Invoice History" description="Open or download saved invoices" onClick={() => setPage("Invoice History")} />
                </div>
              </section>
            </>
          )}

          {page === "E-Invoice" && (
            <>
              <PageHeading
                eyebrow="DOCUMENT MANAGEMENT"
                title="E-Invoice Assistant"
                description="Type invoice details or upload a document. Both options update the same invoice preview and approval flow."
                action={<span className="ai-agent-badge">✦ Liggy agent: extract → verify → save</span>}
              />

              <section className="panel invoice-agent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Use an invoice document</h2>
                    <p className="muted">
                      Choose a picture or PDF to extract details. Review and edit the results in the form and preview below.
                    </p>
                  </div>
                  <span className="ai-agent-badge">✦ Agentic AI review</span>
                </div>
                <form className="invoice-agent-upload" onSubmit={analyzeInvoice}>
                  <Field label="Invoice document (PDF, image, TXT, JSON, or CSV; up to 10 MB)">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json,.csv"
                      onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)}
                      required
                    />
                  </Field>
                  <button className="primary-button" disabled={loading}>
                    {loading ? "Analyzing invoice..." : "Analyze Invoice →"}
                  </button>
                </form>

                {agentReview && (
                  <div className="agent-review-result">
                    <h3>{agentDecision ? "Invoice decision" : "Agent review complete"}</h3>
                    {agentReview.state?.verification_errors?.length > 0 && (
                      <div className="agent-verification-errors">
                        <strong>Items to review</strong>
                        <ul>{agentReview.state.verification_errors.map((item, index) => <li key={index}>{item}</li>)}</ul>
                      </div>
                    )}
                    {agentReview.state?.is_verified && !agentDecision && (
                      <p className="agent-verified">Agent math and customer checks passed. Check the preview before approving.</p>
                    )}
                    {!agentDecision ? (
                      <div className="agent-decision-actions">
                        <button className="primary-button" onClick={() => decideInvoice("approve")} disabled={loading || !invoice.seller || !invoice.buyer || !invoice.date || invoiceItems.some((item) => !item.description || Number(item.quantity) <= 0)}>
                          {loading ? "Saving..." : "Approve and Save PDF"}
                        </button>
                        <button className="secondary-button" onClick={() => decideInvoice("reject")} disabled={loading}>
                          Reject Invoice
                        </button>
                      </div>
                    ) : (
                      <div className="agent-saved-invoice">
                        <div className="success-banner">{agentDecision}</div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <div className="two-column-layout">
                <section className="panel">
                  <h2>Invoice Details</h2>
                  <p className="muted ai-workflow-note">✦ AI-assisted extraction, customer matching, and total checks run before saving.</p>
                  <p className="muted">
                    Fill in the information below. Required fields are marked
                    with *.
                  </p>

                  <form className="form-stack" onSubmit={createInvoice}>
                    <Field label="Invoice Number (leave blank to generate)">
                      <input
                        value={invoice.invoiceNo}
                        onChange={(e) => setInvoice({ ...invoice, invoiceNo: e.target.value })}
                        placeholder="Generated automatically"
                      />
                    </Field>
                    <Field label="Seller / Business Name *">
                      <input
                        value={invoice.seller}
                        onChange={(e) =>
                          setInvoice({ ...invoice, seller: e.target.value })
                        }
                        placeholder="Your business name"
                        required
                      />
                    </Field>

                    <Field label="Buyer / Customer Name *">
                      <input
                        list="saved-customers"
                        value={invoice.buyer}
                        onChange={(e) => updateBuyerName(e.target.value)}
                        placeholder="Customer name"
                        required
                      />
                      <datalist id="saved-customers">{customers.map((customer) => <option key={customer.customer_name} value={customer.customer_name} />)}</datalist>
                    </Field>

                    <Field label="Buyer Tax ID (if applicable)">
                      <input
                        value={invoice.buyerId}
                        onChange={(e) =>
                          setInvoice({ ...invoice, buyerId: e.target.value })
                        }
                        placeholder="Customer tax identification number"
                      />
                    </Field>

                    <Field label="Buyer Email (optional)">
                      <input
                        type="email"
                        value={invoice.buyerEmail}
                        onChange={(e) => setInvoice({ ...invoice, buyerEmail: e.target.value })}
                        placeholder="billing@example.com"
                      />
                    </Field>

                    <Field label="Invoice Date *">
                      <input
                        type="date"
                        value={invoice.date}
                        onChange={(e) =>
                          setInvoice({ ...invoice, date: e.target.value })
                        }
                        required
                      />
                    </Field>

                    <Field label="Currency">
                      <select value={invoice.currency} onChange={(e) => setInvoice({ ...invoice, currency: e.target.value })}>
                        <option value="MYR">MYR — Malaysian Ringgit</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="SGD">SGD — Singapore Dollar</option>
                      </select>
                    </Field>

                    <div className="invoice-items-editor">
                      <div className="panel-heading">
                        <h3>Items</h3>
                        <button type="button" className="text-button" onClick={() => setInvoiceItems([...invoiceItems, { description: "", quantity: 1, unit_price: "" }])}>+ Add item</button>
                      </div>
                      {invoiceItems.map((item, index) => (
                        <div className="invoice-item-edit" key={index}>
                          <Field label={`Description ${index + 1} *`}>
                            <input value={item.description} onChange={(e) => setInvoiceItems(invoiceItems.map((entry, i) => i === index ? { ...entry, description: e.target.value } : entry))} required />
                          </Field>
                          <Field label="Quantity *">
                            <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => setInvoiceItems(invoiceItems.map((entry, i) => i === index ? { ...entry, quantity: e.target.value } : entry))} required />
                          </Field>
                          <Field label={`Unit Price (${invoice.currency}) *`}>
                            <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => setInvoiceItems(invoiceItems.map((entry, i) => i === index ? { ...entry, unit_price: e.target.value } : entry))} required />
                          </Field>
                          {invoiceItems.length > 1 && <button type="button" className="text-button" onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== index))}>Remove</button>}
                        </div>
                      ))}
                    </div>

                    <Field label={`Tax amount (${invoice.currency})`}>
                      <input type="number" min="0" step="0.01" value={invoice.tax} onChange={(e) => setInvoice({ ...invoice, tax: e.target.value })} />
                    </Field>

                    <Field label="Notes (optional)">
                      <textarea value={invoice.notes} onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} placeholder="Payment terms or other notes" />
                    </Field>

                    <div className="invoice-total">
                      <span>Subtotal before tax</span>
                      <strong>{invoice.currency} {invoiceItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0).toFixed(2)}</strong>
                    </div>

                    <p className="small-note">
                      Tax and other statutory fields must be verified for your
                      transaction. This draft does not certify LHDN compliance.
                    </p>

                    <button
                      className="primary-button full-button"
                      disabled={loading}
                    >
                      {loading ? "Preparing review..." : "Check and Preview Invoice →"}
                    </button>
                  </form>
                </section>

                <section className="panel preview-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Invoice Preview</h2>
                      <p className="muted">Review the information before use.</p>
                    </div>
                    <span className="status-badge draft">{agentDecision && agentPdf ? "SAVED" : "LIVE PREVIEW"}</span>
                  </div>

                  <div className="invoice-preview">
                    <div className="preview-brand">liggy.</div>
                    <h2>INVOICE</h2>
                    <p className="muted">
                      {invoice.seller || "Your Business Name"}
                    </p>
                    <div className="preview-detail"><span>Invoice Number</span><strong>{invoice.invoiceNo || "Generated on save"}</strong></div>
                    <hr />
                    <div className="preview-detail">
                      <span>Bill To</span>
                      <strong>{invoice.buyer || "Customer name"}</strong>
                    </div>
                    <div className="preview-detail">
                      <span>Invoice Date</span>
                      <strong>{invoice.date || "—"}</strong>
                    </div>
                    <div className="preview-detail">
                      <span>Customer contact</span>
                      <strong>{invoice.buyerEmail || "No email provided"} · TIN {invoice.buyerId || "not provided"}</strong>
                    </div>

                    <div className="preview-line">
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    {invoiceItems.map((item, index) => (
                      <div className="preview-detail" key={index}>
                        <span>{item.description || "Product / service"}<small>{item.quantity} × {invoice.currency} {Number(item.unit_price || 0).toFixed(2)}</small></span>
                        <strong>{invoice.currency} {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}</strong>
                      </div>
                    ))}
                    <hr />
                    <div className="preview-total">
                      <span>Subtotal</span>
                      <strong>{invoice.currency} {invoiceItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0).toFixed(2)}</strong>
                    </div>
                    <div className="preview-total"><span>Tax</span><strong>{invoice.currency} {Number(invoice.tax || 0).toFixed(2)}</strong></div>
                    <div className="preview-total"><span>Total</span><strong>{invoice.currency} {(invoiceItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0) + Number(invoice.tax || 0)).toFixed(2)}</strong></div>
                    {invoice.notes && <p className="small-note">{invoice.notes}</p>}
                    {agentDecision && <div className="success-banner">{agentDecision}</div>}
                    {agentPdf && <div className="agent-pdf-actions"><a className="primary-button" href={agentPdf.downloadUrl}>Download PDF</a><a className="secondary-button" href={agentPdf.previewUrl} target="_blank" rel="noreferrer">Open PDF</a></div>}
                    {agentPdf && <iframe className="agent-pdf-preview" src={agentPdf.previewUrl} title="Saved invoice PDF" />}
                    {emailPrompt && (emailPrompt.email ? (
                      <div className="email-send-prompt">
                        <strong>Invoice saved. Send it to {emailPrompt.email}?</strong>
                        <div className="agent-pdf-actions">
                          <button type="button" className="primary-button" onClick={sendInvoiceEmail} disabled={loading}>{loading ? "Sending..." : "Yes, send invoice"}</button>
                          <button type="button" className="secondary-button" onClick={() => { setEmailPrompt(null); setEmailOutcome("Email not sent."); }}>No, skip</button>
                        </div>
                      </div>
                    ) : <p className="small-note">No customer email is on record. The invoice was saved without sending.</p>)}
                    {emailOutcome && <p className="agent-verified">{emailOutcome}</p>}
                  </div>
                </section>
              </div>
            </>
          )}

          {page === "Customers" && (
            <>
              <PageHeading
                eyebrow="BUSINESS RECORDS"
                title="Customer Records"
                description="Customer details and their cumulative approved invoice spend from the existing business database."
                action={<span className="ai-agent-badge">{customers.length} customers</span>}
              />
              <section className="panel">
                {businessDataLoaded && customers.length === 0 ? <p className="muted">No customers saved yet. Approved invoices will add customers here automatically.</p> : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Customer</th><th>Email</th><th>Tax ID</th><th>Invoices</th><th>Total spent</th><th>Last invoice</th></tr></thead>
                      <tbody>{customers.map((customer) => (
                        <tr key={customer.customer_name}>
                          <td><strong>{customer.customer_name}</strong></td>
                          <td>{customer.email || "—"}</td>
                          <td>{customer.tin_number || "—"}</td>
                          <td>{customer.invoice_count}</td>
                          <td>{formatCustomerSpend(customer.total_spent_by_currency)}</td>
                          <td>{customer.last_invoice_at ? new Date(customer.last_invoice_at).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {page === "Invoice History" && (
            <>
              <PageHeading
                eyebrow="BUSINESS RECORDS"
                title="E-Invoice History"
                description="Every approved typed or document-based e-invoice is stored here with its PDF."
                action={<span className="ai-agent-badge">{invoiceHistory.length} saved invoices</span>}
              />
              <section className="panel">
                {invoiceHistory.length === 0 ? <p className="muted">No approved invoices yet. They will appear here after you save one from E-Invoice.</p> : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th><th>Source</th><th>Email</th><th>PDF</th></tr></thead>
                      <tbody>{invoiceHistory.map((record) => (
                        <tr key={record.invoice_no}>
                          <td><strong>{record.invoice_no}</strong></td>
                          <td>{record.customer_name || "—"}</td>
                          <td>{record.invoice_date || (record.created_at || "").slice(0, 10) || "—"}</td>
                          <td>{record.invoice_data?.currency || "MYR"} {Number(record.total_amount || 0).toFixed(2)}</td>
                          <td>{record.source === "typed" ? "Typed + AI checks" : record.source === "document" ? "Document + AI extraction" : "Imported history"}</td>
                          <td>{record.email_sent ? "Sent" : "Not sent"}</td>
                          <td className="history-pdf-links">
                            {record.preview_url && <a href={record.preview_url} target="_blank" rel="noreferrer">Preview</a>}
                            {record.download_url && <a href={record.download_url}>Download</a>}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {page === "Liggy AI" && (
            <>
              <PageHeading
                eyebrow="LIGGY HELP"
                title="Ask Liggy"
                description="Get help with invoice creation, the AI review and approval flow, saved PDFs, customers, and sales reports."
                action={<span className="ai-agent-badge">Invoice workflow assistant</span>}
              />
              <section className="panel chat-panel">
                <div className="chat-messages" aria-live="polite">
                  {chatMessages.length === 0 && (
                    <div className="chat-welcome">
                      <div className="brand-icon">✦</div>
                      <div><strong>Hi {user.username}, I’m Liggy Help.</strong><p className="muted">Ask me how the AI checks an invoice, where to find a PDF, or how reports use your saved invoices.</p></div>
                    </div>
                  )}
                  {chatMessages.map((message, index) => (
                    <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}>
                      <span>{message.role === "assistant" ? "Liggy" : "You"}</span>
                      <p>{message.text}</p>
                    </div>
                  ))}
                  {chatBusy && <div className="chat-message assistant"><span>Liggy</span><p>Thinking…</p></div>}
                </div>
                <form className="chat-composer" onSubmit={sendChatMessage}>
                  <input aria-label="Message Liggy Help" value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={2000} placeholder="Ask about using Liggy…" />
                  <button className="primary-button" disabled={chatBusy || !chatInput.trim()}>Send</button>
                </form>
                <p className="small-note">Liggy Help answers questions about this app and its invoice workflow. It cannot approve or send invoices for you.</p>
              </section>
            </>
          )}

          {page === "Daily Sales Report" && (
            <>
              <PageHeading
                eyebrow="SALES ANALYTICS"
                title="Daily Sales Report"
                description={`Live summary of approved invoices saved for ${todayKey}. It updates when your invoice records change.`}
                action={
                  <button
                    className="primary-button"
                    onClick={() => generateReport("daily")}
                    disabled={loading}
                  >
                    {loading ? "Refreshing..." : "Refresh Daily Report"}
                  </button>
                }
              />

              <section className="stats-grid report-stats">
                <StatCard
                  label="Invoiced Today"
                  value={formatCurrencyTotals(todayInvoices) || "MYR 0.00"}
                  note="From approved invoices"
                  icon="↗"
                />
                <StatCard
                  label="Invoices Today"
                  value={String(todayInvoices.length)}
                  note="Saved e-invoices"
                  icon="✓"
                />
                <StatCard
                  label="Customers Today"
                  value={String(new Set(todayInvoices.map((record) => record.customer_name)).size)}
                  note="Unique customers invoiced"
                  icon="▤"
                />
                <StatCard
                  label="Average Invoice"
                  value={formatCurrencyTotals(todayInvoices, true) || "MYR 0.00"}
                  note="Today's average by currency"
                  icon="◷"
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales Transactions</h2>
                    <p className="muted">
                      Historical invoice records from the database
                    </p>
                  </div>
                  <span className="status-badge paid">
                    {todayInvoices.length} records
                  </span>
                </div>
                <TransactionTable sales={todayInvoices.map((record) => ({ id: record.invoice_no, item: record.invoice_no, customer: record.customer_name, amount: record.total_amount, currency: record.invoice_data?.currency || "MYR", status: record.status || "Approved" })).reverse()} />
              </section>

              {report && (
                <section className="panel report-result">
                  <h2>Live Daily Report</h2>
                  <LiveReportSummary report={report} />
                </section>
              )}
            </>
          )}

          {page === "Monthly Insights" && (
            <>
              <PageHeading
                eyebrow="BUSINESS INTELLIGENCE"
                title="Monthly Insights"
                description={`Live summary of approved invoice activity and customer spend for ${monthKey}. It updates when your invoice records change.`}
                action={
                  <button
                    className="primary-button"
                    onClick={() => generateReport("monthly")}
                    disabled={loading}
                  >
                    {loading ? "Refreshing..." : "Refresh Monthly Insights"}
                  </button>
                }
              />

              <section className="stats-grid">
                <StatCard
                  label="Invoiced This Month"
                  value={formatCurrencyTotals(monthInvoices) || "MYR 0.00"}
                  note="From saved e-invoices"
                  icon="↗"
                />
                <StatCard
                  label="Invoices This Month"
                  value={String(monthInvoices.length)}
                  note="Saved invoice records"
                  icon="✓"
                />
                <StatCard
                  label="Average Invoice"
                  value={formatCurrencyTotals(monthInvoices, true) || "MYR 0.00"}
                  note="Monthly average by currency"
                  icon="◷"
                />
                <StatCard
                  label="Customers Invoiced"
                  value={String(new Set(monthInvoices.map((record) => record.customer_name)).size)}
                  note="Unique customers this month"
                  icon="▤"
                />
              </section>

              <section className="dashboard-grid">
                <div className="panel">
                  <h2>Sales Breakdown</h2>
                  <p className="muted">
                    Revenue distribution across your recorded transactions.
                  </p>

                  {monthInvoices.map((record) => (
                    <div className="bar-row" key={record.invoice_no}>
                      <div className="bar-label">
                        <span>{record.customer_name} · {record.invoice_no}</span>
                        <strong>{record.invoice_data?.currency || "MYR"} {Number(record.total_amount).toFixed(2)}</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${
                              amountForCurrency(monthInvoices, record.invoice_data?.currency || "MYR")
                                ? (record.total_amount / amountForCurrency(monthInvoices, record.invoice_data?.currency || "MYR")) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="panel">
                  <h2>Business Insights</h2>
                  <p className="muted">
                    Initial observations from the current data.
                  </p>

                  <div className="insight-item">
                    <span className="insight-icon">↗</span>
                    <div>
                      <strong>Highest-value transaction</strong>
                      <p>
                        {monthInvoices.length
                          ? `${[...monthInvoices]
                              .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0].customer_name} — ${formatCurrencyTotals([ [...monthInvoices].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0] ])}`
                          : "No transactions yet"}
                      </p>
                    </div>
                  </div>

                  <div className="insight-item">
                    <span className="insight-icon">✓</span>
                    <div>
                      <strong>AI-supported invoices</strong>
                      <p>
                        {monthInvoices.length
                          ? `${monthInvoices.filter((record) => ["typed", "document"].includes(record.source)).length} of ${monthInvoices.length} invoices passed through Liggy's agent workflow.`
                          : "Approved invoices will appear here automatically."}
                      </p>
                    </div>
                  </div>

                  <div className="insight-item">
                    <span className="insight-icon">!</span>
                    <div>
                      <strong>Customer follow-up</strong>
                      <p>
                        {monthInvoices.some((record) => !record.email_sent && !record.invoice_data?.customer_email)
                          ? "Some customers do not have an email address saved. Add one in Customer Records for future invoice delivery."
                          : "Customer email details are available for invoice follow-up."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {report && (
                <section className="panel report-result">
                  <h2>Live Monthly Insights</h2>
                  <LiveReportSummary report={report} />
                </section>
              )}

              <p className="small-note">
                These figures use approved invoice records saved in the business database.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, note, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </section>
  );
}

function QuickAction({ icon, title, description, onClick }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-icon">{icon}</span>
      <span className="quick-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="quick-arrow">→</span>
    </button>
  );
}

function TransactionTable({ sales }) {
  if (!sales.length) {
    return <p className="muted">No transactions recorded yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Product / Service</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td>
                <strong>{sale.item}</strong>
              </td>
              <td>{sale.customer}</td>
              <td>{sale.currency || "MYR"} {Number(sale.amount).toFixed(2)}</td>
              <td>
                <span
                  className={`status-badge ${
                    sale.status === "Pending" ? "pending" : "paid"
                  }`}
                >
                  {sale.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveReportSummary({ report }) {
  if (!report) return <p className="muted">Loading saved invoice activity…</p>;
  const totals = Object.entries(report.total_invoiced || {});
  return (
    <div className="live-report-summary">
      <div className="live-report-totals">
        <div><span>Period</span><strong>{report.period}</strong></div>
        <div><span>Invoices</span><strong>{report.invoice_count}</strong></div>
        <div><span>Customers</span><strong>{report.customer_count}</strong></div>
        <div><span>Invoiced total</span><strong>{totals.length ? totals.map(([currency, amount]) => `${currency} ${Number(amount).toFixed(2)}`).join(" · ") : "MYR 0.00"}</strong></div>
      </div>
      {report.invoices.length ? (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th></tr></thead>
            <tbody>{report.invoices.map((invoice) => (
              <tr key={invoice.invoice_no}>
                <td><strong>{invoice.invoice_no}</strong></td>
                <td>{invoice.customer_name || "—"}</td>
                <td>{invoice.date || "—"}</td>
                <td>{invoice.currency || "MYR"} {Number(invoice.total_amount || 0).toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="muted">No approved invoices are saved for this period yet.</p>}
    </div>
  );
}

function buildSalesReport(invoices, type) {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const month = day.slice(0, 7);
  const records = invoices.filter((record) => {
    const recordDate = (record.invoice_date || record.created_at || "").slice(0, 10);
    return type === "daily" ? recordDate === day : recordDate.startsWith(month);
  });
  return {
    period: type === "daily" ? day : month,
    invoice_count: records.length,
    customer_count: new Set(records.map((record) => record.customer_name)).size,
    total_invoiced: currencyTotals(records),
    invoices: records.map(({ invoice_no, customer_name, total_amount, invoice_date, created_at, invoice_data }) => ({
      invoice_no,
      customer_name,
      total_amount,
      currency: invoice_data?.currency || "MYR",
      date: invoice_date || created_at,
    })),
  };
}

function currencyTotals(records) {
  return records.reduce((totals, record) => {
    const currency = record.invoice_data?.currency || "MYR";
    totals[currency] = (totals[currency] || 0) + Number(record.total_amount || 0);
    return totals;
  }, {});
}

function formatCurrencyTotals(records, average = false) {
  const totals = currencyTotals(records);
  const counts = records.reduce((result, record) => {
    const currency = record.invoice_data?.currency || "MYR";
    result[currency] = (result[currency] || 0) + 1;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, value]) => `${currency} ${((average ? value / counts[currency] : value) || 0).toFixed(2)}`)
    .join(" · ");
}

function amountForCurrency(records, currency) {
  return currencyTotals(records)[currency] || 0;
}

function formatCustomerSpend(spend = {}) {
  const entries = Object.entries(spend);
  return entries.length ? entries.map(([currency, total]) => `${currency} ${Number(total).toFixed(2)}`).join(" · ") : "—";
}

export default App;
