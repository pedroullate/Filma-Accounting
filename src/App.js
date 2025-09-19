/* Bloque 0: Imports */
import React, { useEffect, useMemo, useState } from "react";

/* Bloque 0.1: Utils (fuera de App para evitar re-montados) */
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const formatEUR = (n) =>
  new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

const parseMoney = (s) => {
  if (s === "" || s == null) return 0;
  return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
};

const itemTotals = (item) => {
  const base = parseMoney(item.base);
  const iva = (base * (Number(item.iva) || 0)) / 100;
  const irpf = (base * (Number(item.irpf) || 0)) / 100;
  return { base, iva, irpf, total: base + iva - irpf };
};

const poTotalsFromItems = (items) =>
  items.reduce(
    (acc, it) => {
      const t = itemTotals(it);
      acc.base += t.base;
      acc.iva += t.iva;
      acc.irpf += t.irpf;
      acc.total += t.total;
      return acc;
    },
    { base: 0, iva: 0, irpf: 0, total: 0 }
  );

/* Bloque 3.1: Header (componente puro) */
function Header({
  projectName,
  userName,
  setActiveTab,
  handleLogout,
  activeTab,
}) {
  return (
    <header className="topbar">
      <div className="topbar__row1">
        <div className="brand brand--small">
          <span className="brand__primary">Filma</span>
          <span className="brand__tag">Accounting</span>
        </div>

        <div
          className="project-badge project-badge--dynamic"
          title="Proyecto activo"
        >
          <span className="project-badge__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <rect x="3" y="7" width="13" height="10" rx="2" ry="2"></rect>
              <circle cx="7" cy="5" r="2"></circle>
              <circle cx="13" cy="5" r="2"></circle>
              <polygon
                points="19,8 23,10 23,14 19,16"
                fill="currentColor"
              ></polygon>
            </svg>
          </span>
          <span className="project-badge__text">
            {projectName || "Proyecto"}
          </span>
        </div>

        <div className="user-area">
          <span className="user-name">{userName}</span>
          <button className="button button--ghost" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <nav className="topnav">
        {["DASHBOARD", "PRESUPUESTO", "PROVEEDORES", "USUARIOS"].map((tab) => (
          <a
            key={tab}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(tab);
            }}
            style={{
              borderBottomColor:
                activeTab === tab ? "var(--accent)" : "transparent",
            }}
          >
            {tab}
          </a>
        ))}
      </nav>
    </header>
  );
}

/* Bloque 3.2: PageHeader (componente puro) */
function PageHeader({ title }) {
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          minHeight: 44,
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, lineHeight: "28px" }}>{title}</h1>
      </div>
    </div>
  );
}

/* Bloque 3.3: Dashboard ancho completo con Panel PO + Panel facturas */
function DashboardPage({
  pos,
  setPos,
  suppliers,
  accounts,
  poSearch,
  setPoSearch,
  userName,
}) {
  // --- Estado y lógica de POs ---
  const [isPoModalOpen, setPoModalOpen] = useState(false);
  const [selectedPoNumber, setSelectedPoNumber] = useState(null);
  const [poForm, setPoForm] = useState({
    number: "",
    supplierId: "",
    desc: "",
    type: "servicio",
    supplierSearch: "",
    items: [],
  });

  const subOptions = useMemo(
    () =>
      accounts.flatMap((a) =>
        (a.subs || []).map((s) => ({ code: s.code, name: s.name }))
      ),
    [accounts]
  );

  const supplierNameById = (id) =>
    suppliers.find((s) => s.id === id)?.fiscalName || "—";

  const getNextPoNumber = () => {
    const maxNum = pos.reduce((max, p) => {
      const m = String(p.number || "").match(/PO-(\d+)/i);
      const n = m ? parseInt(m[1], 10) : 0;
      return Math.max(max, n);
    }, 0);
    const next = maxNum + 1;
    return `PO-${String(next).padStart(4, "0")}`;
  };

  const openPoModal = () => {
    setPoForm({
      number: getNextPoNumber(),
      supplierId: "",
      desc: "",
      type: "servicio",
      supplierSearch: "",
      items: [
        {
          id: `I${Date.now()}-${Math.random().toString(36).slice(2)}`,
          subCode: "",
          subName: "",
          concept: "",
          base: "",
          iva: "21",
          irpf: "0",
        },
      ],
    });
    setPoModalOpen(true);
  };

  const closePoModal = () => {
    setPoModalOpen(false);
    setPoForm((f) => ({ ...f, supplierSearch: "" }));
  };

  const handleAddItem = () => {
    setPoForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          id: `I${Date.now()}-${Math.random().toString(36).slice(2)}`,
          subCode: "",
          subName: "",
          concept: "",
          base: "",
          iva: "21",
          irpf: "0",
        },
      ],
    }));
  };

  const handleRemoveItem = (id) => {
    setPoForm((f) => ({ ...f, items: f.items.filter((it) => it.id !== id) }));
  };

  const handleUpdateItem = (id, patch) => {
    setPoForm((f) => {
      const items = f.items.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      );
      return { ...f, items };
    });
  };

  const handlePoCreate = (e) => {
    e.preventDefault();
    if (!poForm.number || !poForm.supplierId || !poForm.type) return;
    const validItems = poForm.items.filter(
      (it) => parseMoney(it.base) > 0 && (it.concept || "").trim()
    );
    if (validItems.length === 0) return;

    const totals = poTotalsFromItems(validItems);

    setPos((prev) => [
      ...prev,
      {
        number: poForm.number.trim(),
        supplierId: poForm.supplierId,
        type: poForm.type,
        desc: (poForm.desc || "").trim(),
        createdBy: userName,
        createdAt: new Date().toISOString(),
        approvals: {
          HOD: "pendiente",
          PM: "pendiente",
          Controller: "pendiente",
        },
        items: validItems.map((it) => ({
          ...it,
          base: parseMoney(it.base),
          iva: Number(it.iva) || 0,
          irpf: Number(it.irpf) || 0,
        })),
        sums: totals,
      },
    ]);

    setPoModalOpen(false);
  };

  const updateApproval = (poNumber, role, value) => {
    setPos((prev) =>
      prev.map((p) =>
        p.number === poNumber
          ? { ...p, approvals: { ...p.approvals, [role]: value } }
          : p
      )
    );
  };

  const enterPo = (po) => setSelectedPoNumber(po.number);

  const filteredPOs = pos.filter((po) => {
    if (!poSearch) return true;
    const q = normalize(poSearch);
    return (
      normalize(po.number).includes(q) ||
      normalize(po.desc).includes(q) ||
      normalize(supplierNameById(po.supplierId)).includes(q) ||
      normalize(po.type).includes(q)
    );
  });

  // --- Estado y lógica de FACTURAS (modal vacío preparado) ---
  const [isInvModalOpen, setInvModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({});
  const openInvoiceModal = () => {
    setInvoiceForm({});
    setInvModalOpen(true);
  };
  const closeInvoiceModal = () => setInvModalOpen(false);

  return (
    <section
      style={{
        width: "100%",
        padding: "40px 40px", // márgenes arriba/abajo y laterales
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1fr", // Panel PO (3/4) + Facturas (1/4)
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* Panel PO (3/4 izquierda) */}
        <div className="card" style={{ overflowX: "auto", padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h2 style={{ margin: 0 }}>Panel PO</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Buscar"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                style={{
                  width: 320,
                  height: 36,
                  padding: "8px 10px",
                  border: "1px solid var(--ring)",
                  borderRadius: 8,
                }}
              />
              <button className="button button--primary" onClick={openPoModal}>
                Crear PO
              </button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  PO
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Proveedor
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Tipo
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Descripción
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Base
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Total
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => (
                <tr key={po.number}>
                  <td style={{ padding: "8px" }}>{po.number}</td>
                  <td style={{ padding: "8px" }}>
                    {supplierNameById(po.supplierId)}
                  </td>
                  <td style={{ padding: "8px", textTransform: "capitalize" }}>
                    {po.type}
                  </td>
                  <td style={{ padding: "8px" }}>{po.desc}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {formatEUR(po.sums?.base || 0)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {formatEUR(po.sums?.total || 0)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <button className="button" onClick={() => enterPo(po)}>
                      Entrar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPOs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: "12px", color: "var(--muted)" }}
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Panel Facturas (1/4 derecha) */}
        <div
          className="card"
          style={{
            minHeight: 200,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Panel facturas</h2>
            <button
              className="button button--primary"
              onClick={openInvoiceModal}
            >
              Subir factura
            </button>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            (Próximamente)
          </div>
        </div>
      </div>

      {/* Modal CREAR FACTURA (estructura vacía, listo para campos) */}
      {isInvModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInvoiceModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 65,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 960,
              height: "90vh",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              background: "var(--bg)",
              border: "1px solid var(--ring)",
              borderRadius: 16,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid var(--ring)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Nueva factura</h3>
              <button className="button" onClick={closeInvoiceModal}>
                Cerrar
              </button>
            </div>

            {/* Form vacío (lo completaremos luego) */}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
              }}
              style={{ overflowY: "auto", padding: 20 }}
            >
              <div className="card" style={{ padding: 16, borderRadius: 12 }}>
                <div
                  className="form-grid"
                  style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}
                >
                  <div className="field">
                    <label>Campo 1</label>
                    <input placeholder="(pendiente de definir)" />
                  </div>
                  <div className="field">
                    <label>Campo 2</label>
                    <input placeholder="(pendiente de definir)" />
                  </div>
                  <div className="field">
                    <label>Campo 3</label>
                    <input placeholder="(pendiente de definir)" />
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Descripción</label>
                    <input placeholder="(pendiente de definir)" />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer (botones) */}
            <div
              style={{
                padding: 16,
                borderTop: "1px solid var(--ring)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button className="button" onClick={closeInvoiceModal}>
                Cancelar
              </button>
              <button
                className="button button--primary"
                onClick={() => {
                  /* luego: guardar */
                }}
              >
                Guardar factura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear PO (AMPLIO y dentro de <form> con botón submit) */}
      {isPoModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closePoModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 1200,
              height: "92vh",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              background: "var(--bg)",
              border: "1px solid var(--ring)",
              borderRadius: 16,
            }}
          >
            {/* Header modal */}
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid var(--ring)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Nueva PO</h3>
              <button className="button" onClick={closePoModal}>
                Cerrar
              </button>
            </div>

            {/* Cuerpo + Totales + Acciones TODO dentro del <form> */}
            <form
              className="stack"
              onSubmit={handlePoCreate}
              style={{ overflowY: "auto", padding: 20 }}
            >
              {/* Datos generales */}
              <div className="card" style={{ padding: 16, borderRadius: 12 }}>
                <div
                  className="form-grid"
                  style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
                >
                  <div className="field">
                    <label htmlFor="po-number">Número</label>
                    <input
                      id="po-number"
                      type="text"
                      value={poForm.number || ""}
                      readOnly
                    />
                  </div>

                  <div className="field">
                    <label>Tipo</label>
                    <select
                      value={poForm.type}
                      onChange={(e) =>
                        setPoForm({ ...poForm, type: e.target.value })
                      }
                    >
                      <option value="servicio">Servicio</option>
                      <option value="compra">Compra</option>
                      <option value="alquiler">Alquiler</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="po-supplier-search">Buscar</label>
                    <input
                      id="po-supplier-search"
                      type="text"
                      placeholder="Nombre o CIF"
                      value={poForm.supplierSearch}
                      onChange={(e) =>
                        setPoForm({ ...poForm, supplierSearch: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="po-supplier">Proveedor</label>
                    <select
                      id="po-supplier"
                      value={poForm.supplierId || ""}
                      onChange={(e) =>
                        setPoForm({ ...poForm, supplierId: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        Selecciona proveedor
                      </option>
                      {suppliers
                        .filter((s) => {
                          if (!poForm.supplierSearch) return true;
                          const q = normalize(poForm.supplierSearch);
                          return (
                            normalize(s.fiscalName).includes(q) ||
                            normalize(s.tradeName).includes(q) ||
                            normalize(s.cif).includes(q)
                          );
                        })
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fiscalName} — {s.cif}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="po-desc">Descripción</label>
                    <input
                      id="po-desc"
                      type="text"
                      value={poForm.desc}
                      onChange={(e) =>
                        setPoForm({ ...poForm, desc: e.target.value })
                      }
                      placeholder="Concepto general de la PO"
                    />
                  </div>

                  {suppliers.length === 0 && (
                    <div
                      className="card"
                      style={{
                        gridColumn: "1 / -1",
                        padding: 10,
                        borderRadius: 10,
                        background: "rgba(255,122,24,.08)",
                        border: "1px dashed var(--accent)",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        No hay proveedores creados. Crea uno en la pestaña
                        Proveedores.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ítems */}
              <div className="card" style={{ padding: 16, borderRadius: 12 }}>
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "var(--bg)",
                    zIndex: 1,
                    display: "grid",
                    gridTemplateColumns: "1.2fr 2.4fr 1fr 0.8fr 0.8fr 1fr auto",
                    gap: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  <div>Subcuenta</div>
                  <div>Descripción</div>
                  <div style={{ textAlign: "right" }}>Base</div>
                  <div style={{ textAlign: "right" }}>IVA %</div>
                  <div style={{ textAlign: "right" }}>IRPF %</div>
                  <div style={{ textAlign: "right" }}>Total</div>
                  <div></div>
                </div>

                {poForm.items.map((it) => {
                  const t = itemTotals(it);
                  return (
                    <div
                      key={it.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1.2fr 2.4fr 1fr 0.8fr 0.8fr 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid rgba(0,0,0,.05)",
                      }}
                    >
                      <select
                        value={it.subCode}
                        onChange={(e) => {
                          const sc = e.target.value;
                          const found = subOptions.find((x) => x.code === sc);
                          handleUpdateItem(it.id, {
                            subCode: sc,
                            subName: found ? found.name : "",
                          });
                        }}
                      >
                        <option value="">Selecciona</option>
                        {subOptions.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={it.concept}
                        onChange={(e) =>
                          handleUpdateItem(it.id, { concept: e.target.value })
                        }
                        placeholder="Descripción del ítem"
                      />

                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={it.base}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const cleaned = raw.replace(/[^\d.,]/g, "");
                          handleUpdateItem(it.id, { base: cleaned });
                        }}
                        style={{ textAlign: "right" }}
                      />

                      <input
                        inputMode="numeric"
                        value={it.iva}
                        onChange={(e) =>
                          handleUpdateItem(it.id, {
                            iva: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        style={{ textAlign: "right" }}
                      />

                      <input
                        inputMode="numeric"
                        value={it.irpf}
                        onChange={(e) =>
                          handleUpdateItem(it.id, {
                            irpf: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        style={{ textAlign: "right" }}
                      />

                      <div style={{ textAlign: "right" }}>
                        {formatEUR(t.total)}
                      </div>

                      <button
                        type="button"
                        className="button"
                        onClick={() => handleRemoveItem(it.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  );
                })}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    onClick={handleAddItem}
                  >
                    Añadir ítem
                  </button>
                </div>
              </div>

              {/* Totales + acciones (DENTRO del form) */}
              {(() => {
                const T = poTotalsFromItems(poForm.items);
                return (
                  <div
                    style={{
                      padding: 16,
                      borderTop: "1px solid var(--ring)",
                      display: "grid",
                      gridTemplateColumns:
                        "1fr repeat(4, minmax(120px,auto)) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Totales</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Base
                      </div>
                      <div>{formatEUR(T.base)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        IVA
                      </div>
                      <div>{formatEUR(T.iva)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        IRPF
                      </div>
                      <div>{formatEUR(T.irpf)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Total
                      </div>
                      <div>{formatEUR(T.total)}</div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        className="button"
                        onClick={closePoModal}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={
                          !poForm.supplierId ||
                          poForm.items.filter(
                            (it) =>
                              parseMoney(it.base) > 0 &&
                              (it.concept || "").trim()
                          ).length === 0
                        }
                      >
                        Crear
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Detalle de PO */}
      {selectedPoNumber && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPoNumber(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 960,
              padding: 24,
              background: "var(--bg)",
              border: "1px solid var(--ring)",
              borderRadius: 16,
            }}
          >
            {(() => {
              const po = pos.find((p) => p.number === selectedPoNumber);
              if (!po) return null;
              return (
                <div className="stack">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>PO {po.number}</h3>
                    <button
                      className="button"
                      onClick={() => setSelectedPoNumber(null)}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="stack">
                    <div>
                      <strong>Proveedor:</strong>{" "}
                      {supplierNameById(po.supplierId)}
                    </div>
                    <div>
                      <strong>Tipo:</strong> {po.type}
                    </div>
                    <div>
                      <strong>Descripción:</strong> {po.desc || "—"}
                    </div>
                    <div>
                      <strong>Creada por:</strong> {po.createdBy}{" "}
                      <span style={{ color: "var(--muted)" }}>
                        ({new Date(po.createdAt).toLocaleString("es-ES")})
                      </span>
                    </div>
                  </div>

                  <div className="card" style={{ overflowX: "auto" }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            Subcuenta
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            Descripción
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            Base
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            IVA %
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            IRPF %
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "10px 8px",
                              borderBottom: "1px solid var(--ring)",
                            }}
                          >
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((it) => {
                          const t = itemTotals(it);
                          return (
                            <tr key={it.id}>
                              <td style={{ padding: "8px" }}>
                                {it.subCode}{" "}
                                {it.subName ? `— ${it.subName}` : ""}
                              </td>
                              <td style={{ padding: "8px" }}>{it.concept}</td>
                              <td
                                style={{ padding: "8px", textAlign: "right" }}
                              >
                                {formatEUR(t.base)}
                              </td>
                              <td
                                style={{ padding: "8px", textAlign: "right" }}
                              >
                                {(Number(it.iva) || 0).toFixed(0)}%
                              </td>
                              <td
                                style={{ padding: "8px", textAlign: "right" }}
                              >
                                {(Number(it.irpf) || 0).toFixed(0)}%
                              </td>
                              <td
                                style={{ padding: "8px", textAlign: "right" }}
                              >
                                {formatEUR(t.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      justifyContent: "flex-end",
                    }}
                  >
                    <div>
                      <strong>Base:</strong> {formatEUR(po.sums.base)}
                    </div>
                    <div>
                      <strong>IVA:</strong> {formatEUR(po.sums.iva)}
                    </div>
                    <div>
                      <strong>IRPF:</strong> {formatEUR(po.sums.irpf)}
                    </div>
                    <div>
                      <strong>Total:</strong> {formatEUR(po.sums.total)}
                    </div>
                  </div>

                  <div
                    className="card"
                    style={{ padding: 12, borderRadius: 12 }}
                  >
                    <h4 style={{ marginTop: 0 }}>Aprobaciones</h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 12,
                      }}
                    >
                      {["HOD", "PM", "Controller"].map((role) => (
                        <div key={role} className="field">
                          <label>{role}</label>
                          <select
                            value={po.approvals?.[role] || "pendiente"}
                            onChange={(e) =>
                              updateApproval(po.number, role, e.target.value)
                            }
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="rechazado">Rechazado</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

/* Bloque 3.4: Presupuesto (cuentas, subcuentas, importes y totales) */
function BudgetPage({
  accounts,
  setAccounts,
  acctSearch,
  setAcctSearch,
  isAcctModalOpen,
  setAcctModalOpen,
  acctForm,
  setAcctForm,
  isSubModalOpen,
  setSubModalOpen,
  subForm,
  setSubForm,
}) {
  const matchesQuery = (acc, q) => {
    const inAcc =
      normalize(acc.code).includes(q) || normalize(acc.name).includes(q);
    const inSubs = (acc.subs || []).some(
      (s) => normalize(s.code).includes(q) || normalize(s.name).includes(q)
    );
    return inAcc || inSubs;
  };

  const filteredAccounts = accounts.filter((acc) =>
    acctSearch ? matchesQuery(acc, normalize(acctSearch)) : true
  );

  const accountTotal = (acc) =>
    (acc.subs || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const openAcctModal = () => {
    setAcctForm({ code: "", name: "" });
    setAcctModalOpen(true);
  };
  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!acctForm.code.trim() || !acctForm.name.trim()) return;
    if (accounts.some((a) => a.code === acctForm.code.trim())) {
      alert("Ese código de cuenta ya existe.");
      return;
    }
    setAccounts((prev) => [
      ...prev,
      {
        id: `A${Date.now()}`,
        code: acctForm.code.trim(),
        name: acctForm.name.trim(),
        subs: [],
      },
    ]);
    setAcctModalOpen(false);
  };

  const deleteAccount = (id) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const openSubModal = (parentId) => {
    setSubForm({ parentId, code: "", name: "", amount: "" });
    setSubModalOpen(true);
  };
  const handleCreateSub = (e) => {
    e.preventDefault();
    const { parentId, code, name, amount } = subForm;
    if (!parentId || !code.trim() || !name.trim() || amount === "") return;
    const parsed = Number(String(amount).replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(parsed)) return;

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== parentId) return a;
        if ((a.subs || []).some((s) => s.code === code.trim())) {
          alert("Ese código de subcuenta ya existe en esta cuenta.");
          return a;
        }
        const newSub = {
          id: `S${Date.now()}`,
          code: code.trim(),
          name: name.trim(),
          amount: parsed,
        };
        return { ...a, subs: [...(a.subs || []), newSub] };
      })
    );
    setSubModalOpen(false);
  };

  const deleteSub = (parentId, subId) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === parentId
          ? { ...a, subs: (a.subs || []).filter((s) => s.id !== subId) }
          : a
      )
    );
  };

  return (
    <>
      <PageHeader title="Presupuesto" />

      <section className="container stack" style={{ paddingTop: 0 }}>
        <div className="card" style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              placeholder="Buscar"
              value={acctSearch}
              onChange={(e) => setAcctSearch(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 420,
                height: 36,
                padding: "8px 10px",
                border: "1px solid var(--ring)",
                borderRadius: 8,
              }}
            />
            <button className="button button--primary" onClick={openAcctModal}>
              Crear cuenta
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Código
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Cuenta
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Presupuesto total
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => {
                const total = accountTotal(acc);
                return (
                  <React.Fragment key={acc.id}>
                    <tr>
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        {acc.code}
                      </td>
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        {acc.name}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {formatEUR(total)}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            className="button"
                            onClick={() => openSubModal(acc.id)}
                          >
                            Añadir subcuenta
                          </button>
                          <button
                            className="button"
                            onClick={() => deleteAccount(acc.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>

                    {(acc.subs || []).length > 0 ? (
                      (acc.subs || []).map((s) => (
                        <tr
                          key={s.id}
                          style={{ background: "rgba(0,0,0,0.02)" }}
                        >
                          <td
                            style={{
                              padding: "8px 8px 8px 24px",
                              color: "var(--muted)",
                            }}
                          >
                            {s.code}
                          </td>
                          <td style={{ padding: "8px", color: "var(--muted)" }}>
                            {s.name}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              color: "var(--muted)",
                            }}
                          >
                            {formatEUR(Number(s.amount) || 0)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            <button
                              className="button"
                              onClick={() => deleteSub(acc.id, s.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            padding: "8px 8px 8px 24px",
                            color: "var(--muted)",
                          }}
                        >
                          Sin subcuentas
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: "12px", color: "var(--muted)" }}
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAcctModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAcctModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 560,
              padding: 24,
              borderRadius: 16,
              border: "1px solid var(--ring)",
              background: "var(--bg)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Nueva cuenta</h3>
            <form className="stack" onSubmit={handleCreateAccount}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="acc-code">Código (ej. 01)</label>
                  <input
                    id="acc-code"
                    value={acctForm.code}
                    onChange={(e) =>
                      setAcctForm({ ...acctForm, code: e.target.value })
                    }
                    placeholder="Cuenta"
                  />
                </div>
                <div className="field field--span2">
                  <label htmlFor="acc-name">Nombre de la cuenta</label>
                  <input
                    id="acc-name"
                    value={acctForm.name}
                    onChange={(e) =>
                      setAcctForm({ ...acctForm, name: e.target.value })
                    }
                    placeholder="Nombre cuenta"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => setAcctModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={!acctForm.code.trim() || !acctForm.name.trim()}
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSubModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 640,
              padding: 24,
              borderRadius: 16,
              border: "1px solid var(--ring)",
              background: "var(--bg)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Nueva subcuenta</h3>
            <form className="stack" onSubmit={handleCreateSub}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="sub-parent">Cuenta</label>
                  <select
                    id="sub-parent"
                    value={subForm.parentId}
                    onChange={(e) =>
                      setSubForm({ ...subForm, parentId: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Selecciona cuenta
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="sub-code">Código (ej. 01-01-01)</label>
                  <input
                    id="sub-code"
                    value={subForm.code}
                    onChange={(e) =>
                      setSubForm({ ...subForm, code: e.target.value })
                    }
                    placeholder="Subcuenta"
                  />
                </div>

                <div className="field field--span2">
                  <label htmlFor="sub-name">Nombre de la subcuenta</label>
                  <input
                    id="sub-name"
                    value={subForm.name}
                    onChange={(e) =>
                      setSubForm({ ...subForm, name: e.target.value })
                    }
                    placeholder="Nombre de la subcuenta"
                  />
                </div>

                <div className="field">
                  <label htmlFor="sub-amount">Importe presupuesto</label>
                  <input
                    id="sub-amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={subForm.amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.,]/g, "");
                      setSubForm({ ...subForm, amount: v });
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => setSubModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={
                    !subForm.parentId ||
                    !subForm.code.trim() ||
                    !subForm.name.trim() ||
                    subForm.amount === ""
                  }
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* Bloque 3.5: Proveedores (lista + CRUD) */
function SuppliersPage({
  suppliers,
  setSuppliers,
  pos,
  supplierSearch,
  setSupplierSearch,
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    fiscalName: "",
    tradeName: "",
    cif: "",
    address: "",
    postalCode: "",
    province: "",
    country: "",
    aeatFileName: "",
    bankFileName: "",
  });

  const openSupplierModalCreate = () => {
    setEditingSupplierId(null);
    setSupplierForm({
      fiscalName: "",
      tradeName: "",
      cif: "",
      address: "",
      postalCode: "",
      province: "",
      country: "",
      aeatFileName: "",
      bankFileName: "",
    });
    setSupplierModalOpen(true);
  };

  const openSupplierModalEdit = (supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm({
      fiscalName: supplier.fiscalName || "",
      tradeName: supplier.tradeName || "",
      cif: supplier.cif || "",
      address: supplier.address || "",
      postalCode: supplier.postalCode || "",
      province: supplier.province || "",
      country: supplier.country || "",
      aeatFileName: supplier.aeatFileName || "",
      bankFileName: supplier.bankFileName || "",
    });
    setSupplierModalOpen(true);
  };

  const closeSupplierModal = () => setSupplierModalOpen(false);

  const handleSupplierSave = (e) => {
    e.preventDefault();
    if (!supplierForm.fiscalName?.trim() || !supplierForm.cif?.trim()) return;

    if (editingSupplierId) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === editingSupplierId
            ? {
                ...s,
                fiscalName: supplierForm.fiscalName.trim(),
                tradeName: supplierForm.tradeName.trim(),
                cif: supplierForm.cif.trim(),
                address: supplierForm.address.trim(),
                postalCode: supplierForm.postalCode.trim(),
                province: supplierForm.province.trim(),
                country: supplierForm.country.trim(),
                aeatFileName: supplierForm.aeatFileName || "",
                bankFileName: supplierForm.bankFileName || "",
              }
            : s
        )
      );
    } else {
      const newSupplier = {
        id: `${Date.now()}`,
        fiscalName: supplierForm.fiscalName.trim(),
        tradeName: supplierForm.tradeName.trim(),
        cif: supplierForm.cif.trim(),
        address: supplierForm.address.trim(),
        postalCode: supplierForm.postalCode.trim(),
        province: supplierForm.province.trim(),
        country: supplierForm.country.trim(),
        aeatFileName: supplierForm.aeatFileName || "",
        bankFileName: supplierForm.bankFileName || "",
      };
      setSuppliers((prev) => [...prev, newSupplier]);
      setSelectedSupplierId(newSupplier.id);
    }
    closeSupplierModal();
  };

  const handleSupplierDelete = (id) => {
    const used = pos.some((p) => p.supplierId === id);
    if (used) {
      alert(
        "No se puede eliminar: el proveedor está asociado a una o más POs."
      );
      return;
    }
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    if (selectedSupplierId === id) setSelectedSupplierId(null);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearch) return true;
    const q = normalize(supplierSearch);
    return (
      normalize(s.fiscalName).includes(q) ||
      normalize(s.tradeName).includes(q) ||
      normalize(s.cif).includes(q)
    );
  });

  return (
    <>
      <PageHeader title="Proveedores" />

      <section className="container stack" style={{ paddingTop: 0 }}>
        <div className="card" style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              placeholder="Buscar"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 380,
                height: 36,
                padding: "8px 10px",
                border: "1px solid var(--ring)",
                borderRadius: 8,
              }}
            />
            <button
              className="button button--primary"
              onClick={openSupplierModalCreate}
            >
              Crear proveedor
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Nombre fiscal
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  Nombre comercial
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                >
                  CIF
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--ring)",
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: "8px" }}>{s.fiscalName}</td>
                  <td style={{ padding: "8px" }}>{s.tradeName || "—"}</td>
                  <td style={{ padding: "8px" }}>{s.cif}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button
                        className="button"
                        onClick={() => setSelectedSupplierId(s.id)}
                      >
                        Entrar
                      </button>
                      <button
                        className="button"
                        onClick={() => openSupplierModalEdit(s)}
                      >
                        Editar
                      </button>
                      <button
                        className="button"
                        onClick={() => handleSupplierDelete(s.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: "12px", color: "var(--muted)" }}
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedSupplierId && (
          <div className="card">
            {(() => {
              const s = suppliers.find((x) => x.id === selectedSupplierId);
              if (!s) return null;
              return (
                <div className="stack">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>{s.fiscalName}</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="button"
                        onClick={() => openSupplierModalEdit(s)}
                      >
                        Editar
                      </button>
                      <button
                        className="button"
                        onClick={() => handleSupplierDelete(s.id)}
                      >
                        Eliminar
                      </button>
                      <button
                        className="button"
                        onClick={() => setSelectedSupplierId(null)}
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                  <div className="stack">
                    <div>
                      <strong>Nombre comercial:</strong> {s.tradeName || "—"}
                    </div>
                    <div>
                      <strong>CIF:</strong> {s.cif || "—"}
                    </div>
                    <div>
                      <strong>Dirección:</strong> {s.address || "—"}
                    </div>
                    <div>
                      <strong>Código postal:</strong> {s.postalCode || "—"}
                    </div>
                    <div>
                      <strong>Provincia:</strong> {s.province || "—"}
                    </div>
                    <div>
                      <strong>País:</strong> {s.country || "—"}
                    </div>
                    <div>
                      <strong>Cert. AEAT:</strong> {s.aeatFileName || "—"}
                    </div>
                    <div>
                      <strong>Cert. titularidad bancaria:</strong>{" "}
                      {s.bankFileName || "—"}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {isSupplierModalOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSupplierModal();
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.4)",
              display: "grid",
              placeItems: "center",
              padding: 16,
              zIndex: 70,
            }}
          >
            <div
              className="card"
              style={{
                width: "100%",
                maxWidth: 900,
                padding: 24,
                background: "var(--bg)",
                border: "1px solid var(--ring)",
                borderRadius: 16,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>
                {editingSupplierId ? "Editar proveedor" : "Nuevo proveedor"}
              </h3>

              <form className="stack" onSubmit={handleSupplierSave}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="s-fiscal">Nombre fiscal</label>
                    <input
                      id="s-fiscal"
                      value={supplierForm.fiscalName}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          fiscalName: e.target.value,
                        })
                      }
                      placeholder="Nombre fiscal"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="s-trade">Nombre comercial</label>
                    <input
                      id="s-trade"
                      value={supplierForm.tradeName}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          tradeName: e.target.value,
                        })
                      }
                      placeholder="Nombre comercial"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="s-cif">CIF</label>
                    <input
                      id="s-cif"
                      value={supplierForm.cif}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          cif: e.target.value,
                        })
                      }
                      placeholder="CIF"
                    />
                  </div>

                  <div className="field field--span2">
                    <label htmlFor="s-address">Dirección</label>
                    <input
                      id="s-address"
                      value={supplierForm.address}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          address: e.target.value,
                        })
                      }
                      placeholder="Calle, nº, piso…"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="s-cp">Código postal</label>
                    <input
                      id="s-cp"
                      value={supplierForm.postalCode}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          postalCode: e.target.value,
                        })
                      }
                      placeholder="CP"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="s-province">Provincia</label>
                    <input
                      id="s-province"
                      value={supplierForm.province}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          province: e.target.value,
                        })
                      }
                      placeholder="Provincia"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="s-country">País</label>
                    <input
                      id="s-country"
                      value={supplierForm.country}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          country: e.target.value,
                        })
                      }
                      placeholder="País"
                    />
                  </div>

                  <div className="field-group field--span2">
                    <div className="field">
                      <label htmlFor="s-aeat">Certificado AEAT</label>
                      <input
                        id="s-aeat"
                        type="file"
                        className="file-input"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setSupplierForm({
                            ...supplierForm,
                            aeatFileName: f ? f.name : "",
                          });
                        }}
                      />
                      <small className="help-text">
                        {supplierForm.aeatFileName ||
                          "Ningún archivo seleccionado"}
                      </small>
                    </div>

                    <div className="field">
                      <label htmlFor="s-bank">
                        Certificado titularidad bancaria
                      </label>
                      <input
                        id="s-bank"
                        type="file"
                        className="file-input"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setSupplierForm({
                            ...supplierForm,
                            bankFileName: f ? f.name : "",
                          });
                        }}
                      />
                      <small className="help-text">
                        {supplierForm.bankFileName ||
                          "Ningún archivo seleccionado"}
                      </small>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    onClick={closeSupplierModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={
                      !supplierForm.fiscalName?.trim() ||
                      !supplierForm.cif?.trim()
                    }
                  >
                    {editingSupplierId ? "Guardar" : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

/* Bloque 3.6: Usuarios (placeholder) */
function UsersPage() {
  return (
    <>
      <PageHeader title="Usuarios" />
      <div className="container">
        <div className="card">{/* Próximamente */}</div>
      </div>
    </>
  );
}

/* Bloque 1: Estado principal (App) */
export default function App() {
  // Sesión
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName] = useState("Pedro Ullate");
  const [projectName, setProjectName] = useState("");

  // Navegación
  const [activeTab, setActiveTab] = useState("DASHBOARD");

  // Proveedores
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");

  // POs
  const [pos, setPos] = useState([]);
  const [poSearch, setPoSearch] = useState("");

  // Presupuesto
  const [accounts, setAccounts] = useState([
    {
      id: "A01",
      code: "01",
      name: "GUION Y MÚSICA",
      subs: [
        {
          id: "S010101",
          code: "01-01-01",
          name: "Derechos de autor",
          amount: 0,
        },
      ],
    },
  ]);
  const [acctSearch, setAcctSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAcctModalOpen, setAcctModalOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ code: "", name: "" });
  const [isSubModalOpen, setSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    parentId: "",
    code: "",
    name: "",
    amount: "",
  });

  /* Bloque 2: Login/Logout + persistencia */
  const handleLogin = (e) => {
    e.preventDefault();
    const project = e.target.project.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    if (
      project === "AHOG2026" &&
      email === "ullate@ultrapatico.net" &&
      password === "AHOGADO"
    ) {
      setProjectName("EL AHOGADO (2026)");
      setIsLoggedIn(true);
      setActiveTab("DASHBOARD");
    } else {
      alert("Credenciales incorrectas");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab("DASHBOARD");
  };

  // Cargar de localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("filma_accounting_state");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
      if (Array.isArray(data.pos)) setPos(data.pos);
      if (Array.isArray(data.accounts)) setAccounts(data.accounts);
    } catch {}
  }, []);

  // Guardar en localStorage
  useEffect(() => {
    const payload = JSON.stringify({ suppliers, pos, accounts });
    localStorage.setItem("filma_accounting_state", payload);
  }, [suppliers, pos, accounts]);

  /* Bloque 3.7: Renderizado por pestaña (autenticado) */
  if (isLoggedIn) {
    return (
      <div className="app-shell app-shell--dashboard">
        <Header
          projectName={projectName}
          userName={userName}
          setActiveTab={setActiveTab}
          handleLogout={handleLogout}
          activeTab={activeTab}
        />

        {activeTab === "DASHBOARD" && (
          <DashboardPage
            pos={pos}
            setPos={setPos}
            suppliers={suppliers}
            accounts={accounts}
            poSearch={poSearch}
            setPoSearch={setPoSearch}
            userName={userName}
          />
        )}

        {activeTab === "PRESUPUESTO" && (
          <BudgetPage
            accounts={accounts}
            setAccounts={setAccounts}
            acctSearch={acctSearch}
            setAcctSearch={setAcctSearch}
            isAcctModalOpen={isAcctModalOpen}
            setAcctModalOpen={setAcctModalOpen}
            acctForm={acctForm}
            setAcctForm={setAcctForm}
            isSubModalOpen={isSubModalOpen}
            setSubModalOpen={setSubModalOpen}
            subForm={subForm}
            setSubForm={setSubForm}
          />
        )}

        {activeTab === "PROVEEDORES" && (
          <SuppliersPage
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            pos={pos}
            supplierSearch={supplierSearch}
            setSupplierSearch={setSupplierSearch}
          />
        )}

        {activeTab === "USUARIOS" && <UsersPage />}
      </div>
    );
  }

  /* Bloque 4: Login (público) — logo igual, formulario más alto, toggle de contraseña y link */
  return (
    <div
      className="auth-shell"
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      {/* Logo (igual que antes), un poco separado del form */}
      <div style={{ marginBottom: 32 }}>
        <div className="brand" style={{ transform: "scale(0.9)" }}>
          <span className="brand__primary">Filma</span>
          <span className="brand__tag">Accounting</span>
        </div>
      </div>

      {/* Tarjeta del formulario (subida un poco) */}
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 360,
          transform: "translateY(-40px)", // sube el formulario
        }}
      >
        <form className="stack" onSubmit={handleLogin}>
          <div className="stack">
            <label htmlFor="project">Proyecto</label>
            <input
              type="text"
              id="project"
              name="project"
              placeholder="ID del proyecto"
            />
          </div>

          <div className="stack">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="tu@correo.com"
            />
          </div>

          {/* Contraseña con botón Ver/Ocultar y link de recuperación */}
          <div className="stack">
            <label htmlFor="password">Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="••••••••"
                style={{ width: "100%", paddingRight: 44 }}
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "1px solid var(--ring)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>

            <div style={{ marginTop: 4 }}>
              <a
                href="#"
                style={{
                  fontSize: 13,
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>

          <button type="submit" className="button button--primary">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
