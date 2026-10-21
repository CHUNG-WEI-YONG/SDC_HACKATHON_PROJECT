
import { useState } from "react";
import "./style.css";

const initialSales = [
  { id: 1, item: "Coffee", customer: "Ahmad", amount: 15, status: "Paid" },
  { id: 2, item: "Lunch Set", customer: "Sarah", amount: 24, status: "Paid" },
  { id: 3, item: "Catering Order", customer: "Daniel", amount: 180, status: "Pending" },
  { id: 4, item: "Tea", customer: "Mei Ling", amount: 8, status: "Paid" },
];

function App() {
  const [page, setPage] = useState("Overview");
  const [sales, setSales] = useState(initialSales);
  const [invoice, setInvoice] = useState({
    seller: "",
    buyer: "",
    buyerId: "",
    description: "",
    quantity: 1,
    price: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [agentReview, setAgentReview] = useState(null);
  const [agentDecision, setAgentDecision] = useState("");
  const [agentPdf, setAgentPdf] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const revenue = sales
    .filter((sale) => sale.status === "Paid")
    .reduce((sum, sale) => sum + Number(sale.amount), 0);

  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.amount),
    0
  );

  async function createInvoice(event) {
    event.preventDefault();
    setError("");
    setInvoiceResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/invoices/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...invoice,
          quantity: Number(invoice.quantity),
          price: Number(invoice.price),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate invoice.");
      }

      setInvoiceResult(data.invoice || data);
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
        body: JSON.stringify({ threadId: agentReview.thread_id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save invoice decision.");
      setAgentDecision(data.message || data.status);
      if (data.preview_url && data.download_url) {
        setAgentPdf({ previewUrl: data.preview_url, downloadUrl: data.download_url });
      }
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
      const response = await fetch(`/api/reports/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales,
          period: type === "daily" ? "today" : "this month",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate report.");
      }

      setReport(data.report || data);
    } catch (err) {
      setError(
        err.message.includes("fetch")
          ? "The report API is not connected yet. You can still view the sales figures on this page."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function addSale(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const amount = Number(formData.get("amount"));

    if (!amount || amount <= 0) {
      setError("Enter a valid sales amount.");
      return;
    }

    setSales((previous) => [
      ...previous,
      {
        id: Date.now(),
        item: formData.get("item"),
        customer: formData.get("customer") || "Walk-in customer",
        amount,
        status: formData.get("status"),
      },
    ]);

    setError("");
    form.reset();
  }

  const navItems = [
    { name: "Overview", icon: "◫" },
    { name: "E-Invoice", icon: "▤" },
    { name: "Daily Sales Report", icon: "▥" },
    { name: "Monthly Insights", icon: "◷" },
  ];

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
            <div className="avatar">B</div>
            <div>
              <strong>My Business</strong>
              <small>Business account</small>
            </div>
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
                  label="Recorded Sales"
                  value={`RM ${totalSales.toLocaleString("en-MY", {
                    minimumFractionDigits: 2,
                  })}`}
                  note={`${sales.length} transactions recorded`}
                  icon="↗"
                />
                <StatCard
                  label="Paid Sales"
                  value={`RM ${revenue.toLocaleString("en-MY", {
                    minimumFractionDigits: 2,
                  })}`}
                  note="From paid transactions"
                  icon="✓"
                />
                <StatCard
                  label="Total Orders"
                  value={String(sales.length)}
                  note="Recorded transactions"
                  icon="▤"
                />
                <StatCard
                  label="Pending Payments"
                  value={String(sales.filter((s) => s.status === "Pending").length)}
                  note="Awaiting payment"
                  icon="◷"
                />
              </section>

              <section className="dashboard-grid">
                <div className="panel transactions-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent Transactions</h2>
                      <p className="muted">Your latest recorded sales</p>
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
                </div>
              </section>

              <section className="panel add-sale-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Record a Sale</h2>
                    <p className="muted">
                      Add a transaction to your current dashboard data.
                    </p>
                  </div>
                </div>

                <form className="sale-form" onSubmit={addSale}>
                  <Field label="Product / Service">
                    <input name="item" placeholder="e.g. Coffee" required />
                  </Field>
                  <Field label="Customer">
                    <input name="customer" placeholder="Customer name" />
                  </Field>
                  <Field label="Amount (RM)">
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </Field>
                  <Field label="Payment Status">
                    <select name="status">
                      <option>Paid</option>
                      <option>Pending</option>
                    </select>
                  </Field>
                  <button className="primary-button" type="submit">
                    Add Sale
                  </button>
                </form>
              </section>
            </>
          )}

          {page === "E-Invoice" && (
            <>
              <PageHeading
                eyebrow="DOCUMENT MANAGEMENT"
                title="E-Invoice Assistant"
                description="Enter your transaction details to prepare an invoice draft."
              />

              <section className="panel invoice-agent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Review an Existing Invoice</h2>
                    <p className="muted">
                      Upload a document for Liggy’s extraction and verification agent to review before saving it.
                    </p>
                  </div>
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
                    <h3>Extracted invoice details</h3>
                    <pre>{JSON.stringify(agentReview.state?.invoice_data || {}, null, 2)}</pre>
                    {agentReview.state?.verification_errors?.length > 0 && (
                      <div className="agent-verification-errors">
                        <strong>Items to review</strong>
                        <ul>{agentReview.state.verification_errors.map((item, index) => <li key={index}>{item}</li>)}</ul>
                      </div>
                    )}
                    {agentReview.state?.is_verified && (
                      <p className="agent-verified">Invoice checks passed. Review the extracted details before approving.</p>
                    )}
                    {!agentDecision ? (
                      <div className="agent-decision-actions">
                        <button className="primary-button" onClick={() => decideInvoice("approve")} disabled={loading}>
                          {loading ? "Saving..." : "Approve and Save PDF"}
                        </button>
                        <button className="secondary-button" onClick={() => decideInvoice("reject")} disabled={loading}>
                          Reject Invoice
                        </button>
                      </div>
                    ) : (
                      <div className="agent-saved-invoice">
                        <div className="success-banner">{agentDecision}</div>
                        {agentPdf && (
                          <>
                            <div className="agent-pdf-actions">
                              <a className="primary-button" href={agentPdf.downloadUrl}>
                                Download PDF
                              </a>
                              <a className="secondary-button" href={agentPdf.previewUrl} target="_blank" rel="noreferrer">
                                Open in New Tab
                              </a>
                            </div>
                            <iframe
                              className="agent-pdf-preview"
                              src={agentPdf.previewUrl}
                              title="Approved invoice PDF preview"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <div className="two-column-layout">
                <section className="panel">
                  <h2>Invoice Details</h2>
                  <p className="muted">
                    Fill in the information below. Required fields are marked
                    with *.
                  </p>

                  <form className="form-stack" onSubmit={createInvoice}>
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
                        value={invoice.buyer}
                        onChange={(e) =>
                          setInvoice({ ...invoice, buyer: e.target.value })
                        }
                        placeholder="Customer name"
                        required
                      />
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

                    <Field label="Product / Service Description *">
                      <textarea
                        value={invoice.description}
                        onChange={(e) =>
                          setInvoice({
                            ...invoice,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describe the goods or services sold"
                        required
                      />
                    </Field>

                    <div className="form-row">
                      <Field label="Quantity *">
                        <input
                          type="number"
                          min="1"
                          value={invoice.quantity}
                          onChange={(e) =>
                            setInvoice({
                              ...invoice,
                              quantity: e.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                      <Field label="Unit Price (RM) *">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={invoice.price}
                          onChange={(e) =>
                            setInvoice({ ...invoice, price: e.target.value })
                          }
                          placeholder="0.00"
                          required
                        />
                      </Field>
                    </div>

                    <div className="invoice-total">
                      <span>Subtotal before tax</span>
                      <strong>
                        RM{" "}
                        {(
                          Number(invoice.quantity || 0) *
                          Number(invoice.price || 0)
                        ).toFixed(2)}
                      </strong>
                    </div>

                    <p className="small-note">
                      Tax and other statutory fields must be verified for your
                      transaction. This draft does not certify LHDN compliance.
                    </p>

                    <button
                      className="primary-button full-button"
                      disabled={loading}
                    >
                      {loading ? "Preparing draft..." : "Generate Invoice Draft →"}
                    </button>
                  </form>
                </section>

                <section className="panel preview-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Invoice Preview</h2>
                      <p className="muted">Review the information before use.</p>
                    </div>
                    <span className="status-badge draft">DRAFT</span>
                  </div>

                  <div className="invoice-preview">
                    <div className="preview-brand">liggy.</div>
                    <h2>INVOICE</h2>
                    <p className="muted">
                      {invoice.seller || "Your Business Name"}
                    </p>
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
                      <span>Buyer Tax ID</span>
                      <strong>{invoice.buyerId || "Not provided"}</strong>
                    </div>

                    <div className="preview-line">
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="preview-detail">
                      <span>
                        {invoice.description || "Product / service"}
                        <small>
                          {invoice.quantity} × RM{" "}
                          {Number(invoice.price || 0).toFixed(2)}
                        </small>
                      </span>
                      <strong>
                        RM{" "}
                        {(
                          Number(invoice.quantity || 0) *
                          Number(invoice.price || 0)
                        ).toFixed(2)}
                      </strong>
                    </div>
                    <hr />
                    <div className="preview-total">
                      <span>Subtotal</span>
                      <strong>
                        RM{" "}
                        {(
                          Number(invoice.quantity || 0) *
                          Number(invoice.price || 0)
                        ).toFixed(2)}
                      </strong>
                    </div>

                    {invoiceResult && (
                      <div className="success-banner">
                        Invoice draft generated by the backend.
                        <pre>
                          {JSON.stringify(invoiceResult, null, 2)}
                        </pre>
                      </div>
                    )}

                    <button
                      className="secondary-button full-button"
                      onClick={() => window.print()}
                    >
                      Print / Save Preview as PDF
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}

          {page === "Daily Sales Report" && (
            <>
              <PageHeading
                eyebrow="SALES ANALYTICS"
                title="Daily Sales Report"
                description="Review recorded transactions and payment status."
                action={
                  <button
                    className="primary-button"
                    onClick={() => generateReport("daily")}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : "Generate AI Report"}
                  </button>
                }
              />

              <section className="stats-grid report-stats">
                <StatCard
                  label="Recorded Sales"
                  value={`RM ${totalSales.toFixed(2)}`}
                  note="All transaction statuses"
                  icon="↗"
                />
                <StatCard
                  label="Paid Revenue"
                  value={`RM ${revenue.toFixed(2)}`}
                  note="Paid transactions only"
                  icon="✓"
                />
                <StatCard
                  label="Transactions"
                  value={String(sales.length)}
                  note="Number of records"
                  icon="▤"
                />
                <StatCard
                  label="Pending Amount"
                  value={`RM ${sales
                    .filter((s) => s.status === "Pending")
                    .reduce((sum, s) => sum + Number(s.amount), 0)
                    .toFixed(2)}`}
                  note="Awaiting payment"
                  icon="◷"
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales Transactions</h2>
                    <p className="muted">
                      Sample data and sales added during this session
                    </p>
                  </div>
                  <span className="status-badge paid">
                    {sales.length} records
                  </span>
                </div>
                <TransactionTable sales={[...sales].reverse()} />
              </section>

              {report && (
                <section className="panel report-result">
                  <h2>Generated Daily Report</h2>
                  <pre>{formatReport(report)}</pre>
                </section>
              )}
            </>
          )}

          {page === "Monthly Insights" && (
            <>
              <PageHeading
                eyebrow="BUSINESS INTELLIGENCE"
                title="Monthly Insights"
                description="Understand sales performance and identify opportunities."
                action={
                  <button
                    className="primary-button"
                    onClick={() => generateReport("monthly")}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : "Generate AI Insights"}
                  </button>
                }
              />

              <section className="stats-grid">
                <StatCard
                  label="Recorded Sales"
                  value={`RM ${totalSales.toFixed(2)}`}
                  note="Current sample dataset"
                  icon="↗"
                />
                <StatCard
                  label="Paid Revenue"
                  value={`RM ${revenue.toFixed(2)}`}
                  note="Payments received"
                  icon="✓"
                />
                <StatCard
                  label="Average Transaction"
                  value={`RM ${
                    sales.length
                      ? (totalSales / sales.length).toFixed(2)
                      : "0.00"
                  }`}
                  note="Recorded sales per transaction"
                  icon="◷"
                />
                <StatCard
                  label="Pending Orders"
                  value={String(sales.filter((s) => s.status === "Pending").length)}
                  note="Follow up on payments"
                  icon="▤"
                />
              </section>

              <section className="dashboard-grid">
                <div className="panel">
                  <h2>Sales Breakdown</h2>
                  <p className="muted">
                    Revenue distribution across your recorded transactions.
                  </p>

                  {sales.map((sale) => (
                    <div className="bar-row" key={sale.id}>
                      <div className="bar-label">
                        <span>{sale.item}</span>
                        <strong>RM {Number(sale.amount).toFixed(2)}</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${
                              totalSales
                                ? (sale.amount / totalSales) * 100
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
                        {sales.length
                          ? `${[...sales]
                              .sort((a, b) => b.amount - a.amount)[0].item} — RM ${Math.max(
                              ...sales.map((s) => Number(s.amount))
                            ).toFixed(2)}`
                          : "No transactions yet"}
                      </p>
                    </div>
                  </div>

                  <div className="insight-item">
                    <span className="insight-icon">✓</span>
                    <div>
                      <strong>Collection rate</strong>
                      <p>
                        {totalSales
                          ? `${((revenue / totalSales) * 100).toFixed(1)}% of recorded sales value is paid.`
                          : "Add sales to calculate your collection rate."}
                      </p>
                    </div>
                  </div>

                  <div className="insight-item">
                    <span className="insight-icon">!</span>
                    <div>
                      <strong>Recommended action</strong>
                      <p>
                        {sales.some((s) => s.status === "Pending")
                          ? "Follow up on pending payments to improve cash flow."
                          : "Continue recording sales to build a useful trend."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {report && (
                <section className="panel report-result">
                  <h2>Generated Monthly Insights</h2>
                  <pre>{formatReport(report)}</pre>
                </section>
              )}

              <p className="small-note">
                These figures currently use sample and session-only data, not a
                complete calendar-month database. Historical comparisons will
                require dated, persistent sales records.
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
              <td>RM {Number(sale.amount).toFixed(2)}</td>
              <td>
                <span
                  className={`status-badge ${
                    sale.status === "Paid" ? "paid" : "pending"
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

function formatReport(report) {
  return typeof report === "string"
    ? report
    : JSON.stringify(report, null, 2);
}

export default App;
