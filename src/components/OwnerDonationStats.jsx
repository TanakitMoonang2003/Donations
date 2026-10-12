import { useEffect, useMemo, useState } from "react";
import { fetchDonations } from "../api.js";
import { STREAMER } from "../config/streamer.js";
import { formatMoney } from "../utils/formatMoney.js";

function formatDateTime(isoString) {
  if (!isoString) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

export default function OwnerDonationStats() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load({ silent = false } = {}) {
    setError("");
    if (!silent) setRefreshing(true);
    try {
      const list = await fetchDonations(STREAMER.id);
      setDonations(list);
    } catch (err) {
      setError(err.message || "โหลดประวัติโดเนทไม่ได้");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load({ silent: true });
  }, []);

  const insights = useMemo(() => {
    let total = 0;
    const byDonor = new Map();

    for (const d of donations) {
      const amount = Number(d.amount) || 0;
      total += amount;
      const key = (d.donorName || "ไม่ระบุชื่อ").trim();
      const prev = byDonor.get(key) || { name: key, total: 0, count: 0 };
      prev.total += amount;
      prev.count += 1;
      byDonor.set(key, prev);
    }

    const topDonors = [...byDonor.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const average = donations.length ? total / donations.length : 0;

    return {
      total,
      count: donations.length,
      uniqueDonors: byDonor.size,
      average,
      topDonors,
    };
  }, [donations]);

  return (
    <section className="dashboard-card dashboard-stats-card" aria-labelledby="owner-stats-title">
      <div className="dashboard-stats-head">
        <div>
          <span className="dashboard-eyebrow">DONATION INSIGHTS</span>
          <h2 id="owner-stats-title">ยอดรวม &amp; ประวัติผู้สนับสนุน</h2>
          <p className="dashboard-stats-lead">
            ดูยอดรวมและรายชื่อคนที่โดเนท — ข้อมูลเฉพาะเจ้าของช่อง
          </p>
        </div>
        <button
          type="button"
          className="dashboard-secondary-button dashboard-stats-refresh"
          onClick={() => load()}
          disabled={refreshing}
        >
          {refreshing ? "กำลังโหลด..." : "รีเฟรช"}
        </button>
      </div>

      {loading ? (
        <p className="dashboard-stats-muted">กำลังโหลดสถิติ...</p>
      ) : error ? (
        <p className="dashboard-banner dashboard-banner-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="dashboard-stat-grid">
            <article className="dashboard-stat-tile dashboard-stat-tile--hero">
              <span className="dashboard-stat-label">ยอดรวมทั้งหมด</span>
              <strong className="dashboard-stat-value dashboard-stat-value--money">
                {formatMoney(insights.total)}
              </strong>
              <span className="dashboard-stat-hint">เฉพาะรายการที่ชำระแล้ว (paid)</span>
            </article>
            <article className="dashboard-stat-tile">
              <span className="dashboard-stat-label">จำนวนครั้ง</span>
              <strong className="dashboard-stat-value">{insights.count}</strong>
            </article>
            <article className="dashboard-stat-tile">
              <span className="dashboard-stat-label">ผู้สนับสนุน (ไม่ซ้ำชื่อ)</span>
              <strong className="dashboard-stat-value">{insights.uniqueDonors}</strong>
            </article>
            <article className="dashboard-stat-tile">
              <span className="dashboard-stat-label">เฉลี่ยต่อครั้ง</span>
              <strong className="dashboard-stat-value">
                {insights.count ? formatMoney(insights.average) : "—"}
              </strong>
            </article>
          </div>

          {insights.topDonors.length > 0 ? (
            <div className="dashboard-top-donors">
              <h3>Top ผู้สนับสนุน</h3>
              <ul className="dashboard-top-donors-list">
                {insights.topDonors.map((donor, index) => (
                  <li key={donor.name}>
                    <span className="dashboard-top-rank">{index + 1}</span>
                    <span className="dashboard-top-name">{donor.name}</span>
                    <span className="dashboard-top-meta">
                      {formatMoney(donor.total)} · {donor.count} ครั้ง
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="dashboard-history">
            <h3>ประวัติโดเนท (เรียงล่าสุด)</h3>
            {donations.length === 0 ? (
              <p className="dashboard-stats-muted">ยังไม่มีรายการที่ชำระแล้ว</p>
            ) : (
              <div className="dashboard-history-scroll">
                <table className="dashboard-history-table">
                  <thead>
                    <tr>
                      <th scope="col">ชื่อผู้โดเนท</th>
                      <th scope="col">จำนวน</th>
                      <th scope="col">ข้อความ</th>
                      <th scope="col">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id}>
                        <td data-label="ชื่อ">
                          <strong>{d.donorName}</strong>
                        </td>
                        <td data-label="จำนวน" className="dashboard-history-amount">
                          {formatMoney(d.amount)}
                        </td>
                        <td data-label="ข้อความ" className="dashboard-history-message">
                          {d.message || "—"}
                        </td>
                        <td data-label="วันที่" className="dashboard-history-time">
                          {formatDateTime(d.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
