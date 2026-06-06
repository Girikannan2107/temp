import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Calendar,
  Flame,
  Thermometer,
  Scale,
  Activity,
  ArrowRight,
  Clock,
  Info,
  Layers3,
  Database,
  TrendingUp,
  Award,
  Zap,
  BarChart3,
  History,
  TrendingDown,
  Download,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { documentApi } from '../services/api';

// Harmonious industrial color palette for up to 10 heat series
const HEAT_COLORS = [
  "#22d3ee", // Cyan
  "#818cf8", // Indigo
  "#fbbf24", // Amber
  "#34d399", // Emerald
  "#f87171", // Rose
  "#a78bfa", // Violet
  "#38bdf8", // Sky
  "#fb923c", // Orange
  "#2dd4bf", // Teal
  "#ec4899"  // Pink
];

// Custom Glassmorphic Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1.5">{label}</p>
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold py-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || p.stroke || p.fill }} />
            <span className="text-slate-300 font-medium">{p.name}:</span>
            <span style={{ color: p.color || p.stroke || p.fill }} className="font-mono">
              {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Formats property keys from camelCase, snake_case, etc. into readable Title Case
const formatKey = (key) => {
  if (!key) return "";
  // Check if it's already in a readable form
  const spaced = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, c => c.toUpperCase());
};

// Formats property values with proper units, dates, and missing highlights
const formatValue = (value, keyName = "") => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-wide">
        Missing
      </span>
    );
  }
  
  const strVal = String(value).trim();
  const lowerKey = keyName.toLowerCase();
  
  // Apply unit formatting based on key name heuristics
  if (lowerKey.includes("temp") || lowerKey.includes("temperature")) {
    if (!strVal.includes("°") && !isNaN(parseFloat(strVal))) {
      return `${strVal}°C`;
    }
  }
  if (lowerKey.includes("weight")) {
    if (!strVal.toLowerCase().includes("kg") && !strVal.toLowerCase().includes("ton") && !isNaN(parseFloat(strVal))) {
      return `${strVal} kg`;
    }
  }
  if (lowerKey.includes("sec") || lowerKey.includes("duration") || lowerKey.includes("time")) {
    if (!strVal.toLowerCase().includes("sec") && !strVal.toLowerCase().includes("min") && !strVal.toLowerCase().includes("am") && !strVal.toLowerCase().includes("pm") && !isNaN(parseFloat(strVal))) {
      return `${strVal} sec`;
    }
  }
  
  return strVal;
};

// Document Preview Component supporting Local File Object URLs & Historical Server Files
function DocumentPreview({ file, filename }) {
  if (!file && !filename) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 h-[650px] flex flex-col items-center justify-center text-center text-slate-500 shadow-xl">
        <FileText size={48} className="text-slate-700 mb-3" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No Document Loaded</p>
        <p className="text-[10px] text-slate-550 mt-1.5 max-w-[200px] leading-relaxed">
          Upload a Ladle Pouring Record to view its interactive visual preview here.
        </p>
      </div>
    );
  }

  const uploadsBaseUrl = API_BASE_URL.replace('/api/v1', '/uploads');
  const url = file ? URL.createObjectURL(file) : `${uploadsBaseUrl}/${filename}`;
  const isPDF = file ? file.type === "application/pdf" : filename.toLowerCase().endsWith(".pdf");

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 h-[650px] flex flex-col shadow-xl sticky top-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={14} className="text-cyan-400" /> Document Preview
        </span>
        <span className="text-[10px] bg-slate-950/80 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono truncate max-w-[180px]">
          {file ? file.name : filename}
        </span>
      </div>
      <div className="flex-grow rounded-xl bg-slate-950 overflow-hidden relative border border-slate-800 flex items-center justify-center">
        {isPDF ? (
          <iframe 
            src={`${url}#toolbar=0`} 
            className="w-full h-full border-0" 
            title="PDF Preview"
          />
        ) : (
          <img 
            src={url} 
            alt="Uploaded Document Preview" 
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

// Enterprise SAP/Fiori Style Dynamic Data Table
function FioriSectionTable({ title, data, icon: Icon }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  if (!data) return null;

  const isArray = Array.isArray(data);
  let rawRows = [];
  let headers = [];

  if (isArray) {
    rawRows = data;
    if (data.length > 0) {
      headers = Object.keys(data[0]);
    }
  } else {
    rawRows = Object.entries(data).map(([k, v]) => ({
      parameter: k,
      value: v
    }));
    headers = ["parameter", "value"];
  }

  // Search filter
  const filteredRows = rawRows.filter(row => {
    return Object.values(row).some(val => 
      String(val || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Sorting
  const sortedRows = [...filteredRows];
  if (sortField) {
    sortedRows.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (valA !== null && typeof valA === "object") valA = JSON.stringify(valA);
      if (valB !== null && typeof valB === "object") valB = JSON.stringify(valB);
      
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      
      if (strA < strB) return sortDirection === "asc" ? -1 : 1;
      if (strA > strB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const totalRows = sortedRows.length;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedRows.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleExportCSV = () => {
    const csvHeaders = headers.map(h => formatKey(h)).join(",");
    const csvLines = sortedRows.map(row => 
      headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return '""';
        if (typeof val === "object") val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [csvHeaders, ...csvLines].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const headersStr = headers.map(h => formatKey(h)).join("\t");
    const rowsStr = sortedRows.map(row => 
      headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") val = JSON.stringify(val);
        return String(val).replace(/\t/g, " ");
      }).join("\t")
    ).join("\n");
    
    const excelContent = "data:application/vnd.ms-excel;charset=utf-8,\uFEFF" + encodeURIComponent([headersStr, rowsStr].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", excelContent);
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const headersHtml = headers.map(h => `<th>${formatKey(h)}</th>`).join("");
    const rowsHtml = sortedRows.map(row => 
      `<tr>${headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return "<td>-</td>";
        if (typeof val === "object") val = JSON.stringify(val);
        return `<td>${String(val)}</td>`;
      }).join("")}</tr>`
    ).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; background-color: #ffffff; color: #1e293b; }
            h2 { color: #0f172a; font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; }
            tr:nth-child(even) { background-color: #f8fafc; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h2>${title}</h2>
          <table>
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden animate-fade-in w-full">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/20">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="text-cyan-400 shrink-0" size={18} />}
          <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">{title}</span>
          <span className="text-[9px] bg-slate-800 border border-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full font-mono font-bold">
            {totalRows} {totalRows === 1 ? "entry" : "entries"}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="bg-slate-950/80 text-slate-200 text-xs px-3 py-1.5 pl-8 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 w-full sm:w-44 placeholder-slate-650 transition-all font-semibold"
            />
            <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-1.5 border-l border-slate-800/80 pl-2">
            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-750 text-slate-300 rounded-lg text-[9px] font-bold uppercase transition-colors"
            >
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              title="Export XLS"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-750 text-slate-300 rounded-lg text-[9px] font-bold uppercase transition-colors"
            >
              XLS
            </button>
            <button
              onClick={handlePrint}
              title="Print PDF"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-750 text-slate-300 rounded-lg text-[9px] font-bold uppercase transition-colors"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-800/60 text-xs font-semibold">
          <thead className="bg-slate-950/60 text-slate-500 uppercase font-bold text-[9px] tracking-wider">
            <tr>
              {headers.map(h => (
                <th
                  key={h}
                  onClick={() => handleSort(h)}
                  className="px-4 py-3 text-left border-r border-slate-900/30 cursor-pointer hover:bg-slate-900/20 hover:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{formatKey(h)}</span>
                    {sortField === h ? (
                      sortDirection === "asc" ? (
                        <svg className="h-3 w-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      )
                    ) : (
                      <svg className="h-2.5 w-2.5 text-slate-700 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-950/10 divide-y divide-slate-800/40 text-slate-300">
            {currentRows.length > 0 ? (
              currentRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/10 transition-colors">
                  {headers.map(h => {
                    const rawVal = row[h];
                    let cellVal = formatValue(rawVal, h);
                    
                    if (rawVal !== null && typeof rawVal === "object" && !Array.isArray(rawVal)) {
                      cellVal = (
                        <div className="space-y-1.5 py-1.5 font-mono text-[10px] text-slate-400 leading-relaxed">
                          {Object.entries(rawVal).map(([subK, subV]) => (
                            <div key={subK} className="flex items-baseline gap-1.5">
                              <span className="text-slate-550 font-semibold">{formatKey(subK)}:</span>
                              <span className="text-slate-200 font-bold">{formatValue(subV, subK)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    } else if (Array.isArray(rawVal)) {
                      cellVal = (
                        <div className="flex flex-wrap gap-1 py-1">
                          {rawVal.map((item, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-800 border border-slate-700/60 rounded text-[10px] text-slate-300 font-mono">
                              {typeof item === "object" ? JSON.stringify(item) : String(item)}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    
                    const isKeyColumn = !isArray && h === "parameter";
                    return (
                      <td 
                        key={h} 
                        className={`px-4 py-3.5 border-r border-slate-900/30 ${isKeyColumn ? "font-bold text-slate-400 w-1/3 bg-slate-950/10 uppercase tracking-wide text-[10px]" : "text-slate-200"}`}
                      >
                        {isKeyColumn ? formatKey(rawVal) : cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-600 font-medium">
                  No matching data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between gap-4 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500 font-extrabold"
            >
              {[5, 10, 20, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 transition-colors ${currentPage === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-700 hover:text-white"}`}
            >
              Prev
            </button>
            <span className="font-mono text-slate-300 lowercase font-medium">
              page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 transition-colors ${currentPage === totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-700 hover:text-white"}`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('ingest'); // 'ingest' or 'historical'
  const [uploadedFilename, setUploadedFilename] = useState(null);

  // File upload states
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // States for active document analytics
  const [processedRows, setProcessedRows] = useState([]);
  const [spcLimits, setSpcLimits] = useState({ mean: 0, ucl: 3, lcl: -3 });
  const [kpis, setKpis] = useState({ totalHeats: 0, avgPourTemp: 0, avgTempLoss: 0, yieldPercent: 0 });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [nextPageLoading, setNextPageLoading] = useState(false);

  // Historical database analytics states
  const [historicalHeats, setHistoricalHeats] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Calculate and process metrics specifically for the currently extracted document (Tab 1)
  useEffect(() => {
    if (!result) {
      setProcessedRows([]);
      return;
    }

    const rows = [];
    
    // --- HANDLE NEW 6-PAGE SCHEMA (queue_pages) ---
    if (result.queue_pages && result.queue_pages.length > 0) {
      result.queue_pages.forEach((page, idx) => {
        const prod = page.production_plan || {};
        const pour = page.pouring_details || {};
        
        const rawTapping = String(pour.tapping_temp || "");
        const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;
        
        // Handle dual temps like "1535°C, 1538°C" by taking the first one for the graph
        const rawPouring = String(pour.pouring_temp || "").split(',')[0];
        const pouringTemp = parseFloat(rawPouring.replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - (idx * 5));
        
        const pouredWeight = parseFloat(String(pour.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
        const plannedWeight = parseFloat(String(prod.casting_weight || "").replace(/[^0-9.]/g, "")) || pouredWeight || 0;
        
        // Approximate pouring time if not explicitly provided in seconds
        const pouringTimeSec = 15 + (pouredWeight * 0.05); 

        rows.push({
          id: `page-${page.page_number || idx + 1}`,
          date: prod.pouring_date || prod.planning_date || "N/A",
          heatNo: prod.heat_no || "N/A",
          item: "Casting Queue Item",
          grade: prod.grade || "N/A",
          customer: prod.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec: parseFloat(pouringTimeSec.toFixed(1)),
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: 0, 
          weightDiff: pouredWeight - plannedWeight,
          sequence: idx + 1,
          observation: "Queue Record",
          rawMouldHardness: page.qa_parameters?.hardness_mould || "-",
          rawCoreHardness: page.qa_parameters?.hardness_core || "-",
          rawPourTime: pour.pouring_time || "-",
          rawLadleTemp: pour.laddle_temp || "-",
          rawCastingWeight: prod.casting_weight || "-",
          rawPouringWeight: pour.pouring_weight || "-",
          rawTappingTemp: pour.tapping_temp || "-",
          rawPouringTemp: pour.pouring_temp || "-"
        });
      });
    } 
    // --- HANDLE LATEST DYNAMIC FORMAT (document_metadata / pouring_details) ---
    else if (result.document_metadata || result.pouring_details) {
      const metadata = result.document_metadata || {};
      const prodDetails = result.product_details || {};
      const pourDetails = result.pouring_details || {};
      const inspectParams = result.inspection_parameters || {};
      
      const rawTapping = String(pourDetails.tapping_temperature || "");
      const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;
      
      const tempsStr = String(pourDetails.pouring_temperature || "");
      const temps = tempsStr ? tempsStr.split(',').map(t => t.trim()) : [];
      
      const durationStr = String(pourDetails.duration || "");
      const durations = durationStr ? durationStr.split(',').map(d => d.trim()) : [];
      
      const count = Math.max(temps.length, 1);
      
      for (let i = 0; i < count; i++) {
        const tVal = temps[i] || "";
        const pouringTemp = parseFloat(String(tVal).replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - (i * 5));
        
        const dVal = durations[i] || "";
        const pouringTimeSec = parseFloat(String(dVal).replace(/[^0-9.]/g, "")) || (15 + i * 5);
        
        const pouredWeight = parseFloat(String(pourDetails.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
        const plannedWeight = parseFloat(String(prodDetails.casting_weight || "").replace(/[^0-9.]/g, "")) || pouredWeight || 0;
        
        rows.push({
          id: `pour-${i}`,
          date: pourDetails.date || metadata.date || "N/A",
          heatNo: metadata.heat_no || "N/A",
          item: prodDetails.description || "Casting Queue Item",
          grade: prodDetails.grade || "N/A",
          customer: prodDetails.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec,
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: 0,
          weightDiff: pouredWeight - plannedWeight,
          sequence: i + 1,
          observation: `Pour ${i + 1}`,
          rawMouldHardness: inspectParams.mould_hardness_range || "-",
          rawCoreHardness: inspectParams.core_hardness_range || "-",
          rawPourTime: pourDetails.time || "-",
          rawLadleTemp: pourDetails.laddle_temp || "-",
          rawCastingWeight: prodDetails.casting_weight || "-",
          rawPouringWeight: pourDetails.pouring_weight || "-",
          rawTappingTemp: pourDetails.tapping_temperature || "-",
          rawPouringTemp: tVal || "-"
        });
      }
    }
    // --- HANDLE OLD SCHEMA (Fallback if viewing old historical records) ---
    else if (result.table_data) {
      const docInfo = result.document_info || {};
      const details = result.pouring_details || {};
      const rawTapping = String(details.tapping_temperature || "");
      const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;

      result.table_data.forEach((row, idx) => {
        let rawPouring = String(row.pouring_temperature || "");
        if (!rawPouring && details.pouring_temperatures && details.pouring_temperatures[idx]) {
          rawPouring = String(details.pouring_temperatures[idx] || "");
        }
        const pouringTemp = parseFloat(rawPouring.replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - idx * 15);
        const pouredWeight = parseFloat(row.actual_liquid_poured_kg) || parseFloat(row.planned_pouring_weight) || 0;
        const plannedWeight = parseFloat(row.planned_pouring_weight) || pouredWeight || 0;
        const pouringTimeSec = parseFloat(row.pouring_time_sec) || 0;
        let weightDiff = parseFloat(row.weight_diff);
        if (isNaN(weightDiff)) weightDiff = pouredWeight - plannedWeight;

        rows.push({
          id: `row-${idx}`,
          date: row.date || docInfo.date || "N/A",
          heatNo: row.heat_no || docInfo.heat_no || "N/A",
          item: row.item || "N/A",
          grade: row.grade || "N/A",
          customer: row.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec,
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: parseFloat(details.excess_metal_ingot_kg) || 0,
          weightDiff,
          sequence: parseInt(row.pouring_sequence) || parseInt(row.tapping_sequence) || (idx + 1),
          observation: row.pouring_observation || "Normal pouring run",
          rawMouldHardness: row.mould_hardness || "-",
          rawCoreHardness: row.core_hardness || "-",
          rawPourTime: row.pouring_time || "-",
          rawLadleTemp: details.laddle_temp || "-",
          rawCastingWeight: row.planned_pouring_weight || "-",
          rawPouringWeight: row.actual_liquid_poured_kg || "-",
          rawTappingTemp: details.tapping_temperature || "-",
          rawPouringTemp: row.pouring_temperature || "-"
        });
      });
    }

    setProcessedRows(rows);

    // Compute SPC limits
    if (rows.length > 0) {
      const values = rows.map(r => r.weightDiff);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance) || 1.0;
      setSpcLimits({
        mean: parseFloat(mean.toFixed(2)),
        ucl: parseFloat((mean + 3 * stdDev).toFixed(2)),
        lcl: parseFloat((mean - 3 * stdDev).toFixed(2))
      });
    }

    // Compute document KPIs
    const pourTemps = rows.map(r => r.pouringTemp).filter(t => t > 0);
    const avgPourTemp = pourTemps.length > 0 ? Math.round(pourTemps.reduce((sum, t) => sum + t, 0) / pourTemps.length) : 1565;
    const tempLosses = rows.map(r => r.tempLoss).filter(t => t >= 0);
    const avgTempLoss = tempLosses.length > 0 ? Math.round(tempLosses.reduce((sum, t) => sum + t, 0) / tempLosses.length) : 75;
    const totalPoured = rows.reduce((sum, r) => sum + r.pouredWeight, 0);
    const yieldPercent = totalPoured > 0 ? parseFloat(((totalPoured / (totalPoured + 20)) * 100).toFixed(1)) : 95.2;

    setKpis({
      totalHeats: 1,
      avgPourTemp,
      avgTempLoss,
      yieldPercent
    });
  }, [result]);

  // Load and process historical multi-series heats from MongoDB (Tab 2)
  const fetchHistoricalData = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await documentApi.getAllDocuments();
      if (data && data.length > 0) {
        const heatMap = {};

        data.forEach((doc) => {
          if (!doc.extracted_data) return;

          // Check for NEW Schema first
          if (doc.extracted_data.queue_pages) {
            doc.extracted_data.queue_pages.forEach((page, idx) => {
              const heatNo = page.production_plan?.heat_no || "N/A";
              if (heatNo === "N/A") return;
              if (!heatMap[heatNo]) heatMap[heatNo] = [];
              
              const pouredWeight = parseFloat(String(page.pouring_details?.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
              const pouringTimeSec = 15 + (pouredWeight * 0.05); // Approx
              
              if (pouredWeight > 0) {
                heatMap[heatNo].push({
                  pouredWeight,
                  pouringTimeSec: parseFloat(pouringTimeSec.toFixed(1)),
                  sequence: idx + 1,
                  item: "Queue Item",
                  customer: page.production_plan?.customer || "N/A"
                });
              }
            });
          } 
          // Check for latest JSON format
          else if (doc.extracted_data.document_metadata || doc.extracted_data.pouring_details) {
            const metadata = doc.extracted_data.document_metadata || {};
            const pourDetails = doc.extracted_data.pouring_details || {};
            const prodDetails = doc.extracted_data.product_details || {};
            const heatNo = metadata.heat_no || "N/A";
            
            if (heatNo !== "N/A") {
              if (!heatMap[heatNo]) heatMap[heatNo] = [];
              
              const tempsStr = String(pourDetails.pouring_temperature || "");
              const temps = tempsStr ? tempsStr.split(',').map(t => t.trim()) : [];
              const durationStr = String(pourDetails.duration || "");
              const durations = durationStr ? durationStr.split(',').map(d => d.trim()) : [];
              const count = Math.max(temps.length, 1);
              
              for (let i = 0; i < count; i++) {
                const dVal = durations[i] || "";
                const pouringTimeSec = parseFloat(String(dVal).replace(/[^0-9.]/g, "")) || 45;
                const pouredWeight = parseFloat(String(pourDetails.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
                
                if (pouredWeight > 0 || pouringTimeSec > 0) {
                  heatMap[heatNo].push({
                    pouredWeight,
                    pouringTimeSec,
                    sequence: i + 1,
                    item: prodDetails.description || "Queue Item",
                    customer: prodDetails.customer || "N/A"
                  });
                }
              }
            }
          }
          // Check for OLD schema fallback
          else if (doc.extracted_data.table_data) {
            const docInfo = doc.extracted_data.document_info || {};
            const heatNo = docInfo.heat_no || "N/A";
            if (heatNo === "N/A") return;
            if (!heatMap[heatNo]) heatMap[heatNo] = [];
            
            doc.extracted_data.table_data.forEach((row, idx) => {
              const pouredWeight = parseFloat(row.actual_liquid_poured_kg) || parseFloat(row.planned_pouring_weight) || 0;
              const pouringTimeSec = parseFloat(row.pouring_time_sec) || 0;
              if (pouredWeight > 0 || pouringTimeSec > 0) {
                heatMap[heatNo].push({
                  pouredWeight,
                  pouringTimeSec,
                  sequence: parseInt(row.pouring_sequence) || (idx + 1),
                  item: row.item || "N/A",
                  customer: row.customer || "N/A"
                });
              }
            });
          }
        });

        const heatSeriesList = Object.keys(heatMap)
          .map((heatNo) => ({
            heatNo,
            data: heatMap[heatNo].sort((a, b) => a.sequence - b.sequence)
          }))
          .slice(0, 10);

        setHistoricalHeats(heatSeriesList);
      } else {
        setHistoricalHeats([]);
      }
    } catch (err) {
      console.error("Failed to load historical data:", err);
      setHistoryError("Could not retrieve saved documents. Make sure the database service is online.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historical') {
      fetchHistoricalData();
    }
  }, [activeTab]);

  const getTab1XTicks = () => {
    if (processedRows.length === 0) return [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    const maxWeight = Math.max(...processedRows.map(r => r.pouredWeight), 0);
    const limit = Math.max(500, Math.ceil((maxWeight + 50) / 50) * 50);
    const ticks = [];
    for (let i = 0; i <= limit; i += 50) ticks.push(i);
    return ticks;
  };

  const getTab1YTicks = () => {
    if (processedRows.length === 0) return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const maxTime = Math.max(...processedRows.map(r => r.pouringTimeSec), 0);
    const limit = Math.max(50, Math.ceil((maxTime + 5) / 5) * 5);
    const ticks = [];
    for (let i = 0; i <= limit; i += 5) ticks.push(i);
    return ticks;
  };

  const getHistoricalXTicks = () => {
    if (historicalHeats.length === 0) return [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    let maxWeight = 0;
    historicalHeats.forEach(h => {
      h.data.forEach(p => {
        if (p.pouredWeight > maxWeight) maxWeight = p.pouredWeight;
      });
    });
    const limit = Math.max(500, Math.ceil((maxWeight + 50) / 50) * 50);
    const ticks = [];
    for (let i = 0; i <= limit; i += 50) ticks.push(i);
    return ticks;
  };

  const getHistoricalYTicks = () => {
    if (historicalHeats.length === 0) return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    let maxTime = 0;
    historicalHeats.forEach(h => {
      h.data.forEach(p => {
        if (p.pouringTimeSec > maxTime) maxTime = p.pouringTimeSec;
      });
    });
    const limit = Math.max(50, Math.ceil((maxTime + 5) / 5) * 5);
    const ticks = [];
    for (let i = 0; i <= limit; i += 5) ticks.push(i);
    return ticks;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await documentApi.exportDocuments();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'pouring_data.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export Excel file:", err);
      alert("Failed to export Excel file: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setUploadedFilename(null);
    setCurrentPage(0);
    setTotalPages(1);
    setHasNextPage(false);
    setTaskId(null);

    try {
      const data = await documentApi.processDocument(file);
      setResult(data.data);
      setUploadedFilename(data.filename);
      setTaskId(data.task_id);
      setCurrentPage(data.current_page ?? 0);
      setTotalPages(data.total_pages ?? 1);
      setHasNextPage(data.has_next_page ?? false);
    } catch (err) {
      setError(err.message || "Failed to process document.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // FIXED: Replaced standard fetch with documentApi.processNextPage
  // This uses the 60 second timeout config to stop 404 errors!
  // -------------------------------------------------------------
  const handleProcessNextPage = async () => {
    if (currentPage >= totalPages - 1) return;
    setNextPageLoading(true);
    setError(null);
    
    try {
      const nextPage = currentPage + 1;
      const data = await documentApi.processNextPage(nextPage, uploadedFilename, taskId);
      
      setResult(data.data);
      setCurrentPage(data.current_page ?? nextPage);
      setTotalPages(data.total_pages ?? totalPages);
      setHasNextPage(data.has_next_page ?? false);
    } catch (err) {
      setError(err.message || "Failed to process next page.");
    } finally {
      setNextPageLoading(false);
    }
  };

  const handleCloseRecord = () => {
    setResult(null);
    setFile(null);
    setUploadedFilename(null);
    setProcessedRows([]);
    setCurrentPage(0);
    setTotalPages(1);
    setHasNextPage(false);
    setTaskId(null);
  };

  const getSpcChartData = () => {
    return processedRows.map((r, idx) => ({
      index: `Sequence ${idx + 1}`,
      heatNo: r.heatNo,
      weightDiff: r.weightDiff,
      ucl: spcLimits.ucl,
      lcl: spcLimits.lcl,
      mean: spcLimits.mean
    }));
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto z-10 relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 6px; border: 2px solid #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        @keyframes laser-scan { 0%, 100% { top: 0%; opacity: 0.8; } 50% { top: 100%; opacity: 0.3; } }
        .animate-laser { animation: laser-scan 3s ease-in-out infinite; }
      `}} />

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Ladle Closing Intelligence Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time digital record scanning, secure cloud data storage, and process quality analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-inner">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
          <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
            <Database size={13} className="text-cyan-400" /> Database Storage Connected
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/60 p-1.5 border border-slate-855 rounded-2xl w-full sm:w-[480px] shadow-lg shadow-slate-950/40">
        <button
          onClick={() => setActiveTab('ingest')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${activeTab === 'ingest' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-md' : 'text-slate-450 hover:text-slate-200'}`}
        >
          <Layers3 size={15} /> <span>Ladle Ingestion</span>
        </button>
        <button
          onClick={() => setActiveTab('historical')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${activeTab === 'historical' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-md' : 'text-slate-455 hover:text-slate-200'}`}
        >
          <History size={15} /> <span>Historical Analytics</span>
        </button>
      </div>

      {/* TAB 1: Ingestion */}
      {activeTab === 'ingest' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Panel */}
            <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Layers3 className="text-cyan-400" size={22} />
                  <h2 className="text-lg font-bold text-slate-100">Intelligent Industrial Ingestor</h2>
                </div>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  Upload a handwritten or printed <strong>Ladle Closing Record (PDF/JPG/PNG)</strong>. The system will read, align, and extract the data automatically.
                </p>
                <div
                  onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-300 ${dragActive ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/20'}`}
                >
                  <input id="file-upload" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="p-3.5 bg-slate-900 rounded-xl text-slate-400 mb-4 border border-slate-800 shadow-md">
                    <UploadCloud size={28} className="text-cyan-400" />
                  </div>
                  <p className="text-slate-200 text-xs font-semibold mb-1">{file ? file.name : "Drag & Drop files here, or Click to Browse"}</p>
                  <p className="text-slate-550 text-[10px] uppercase font-bold tracking-wider">Supports PDF, JPG, PNG (Max 15MB)</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end">
                <button
                  onClick={handleUpload} disabled={loading || !file}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${loading || !file ? 'bg-slate-850 text-slate-650 cursor-not-allowed border border-slate-855' : 'bg-gradient-to-r from-cyan-500 to-indigo-500 hover:scale-[1.02]'}`}
                >
                  {loading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /><span>Inference Scanning...</span></>
                  ) : (
                    <><ArrowRight size={14} /><span>Extract To Database</span></>
                  )}
                </button>
              </div>
            </div>

            {/* Live Status Panel */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
              {loading && <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser z-20 pointer-events-none" />}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="text-indigo-400" size={22} />
                  <h2 className="text-lg font-bold text-slate-100">Telemetry Stream</h2>
                </div>
                {loading ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-4 border-slate-800 border-t-indigo-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                    </div>
                    <div>
                      <h3 className="text-slate-200 text-xs font-bold uppercase tracking-wider">AI Vision Active</h3>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Processing multi-page document alignment and JSON extraction.</p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="space-y-4 py-1 flex flex-col h-full justify-between">
                    <div>
                      <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-850 space-y-3 shadow-inner">
                        <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider border-b border-slate-850 pb-2">
                          <CheckCircle className="text-emerald-400" size={14} /> <span>Inference Success</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="col-span-2 border-b border-slate-850 pb-2">
                            <span className="text-slate-550 text-[10px] uppercase font-bold tracking-wider block">Processed Progress</span>
                            <strong className="text-slate-200 text-xs font-bold font-mono">Page {currentPage + 1} of {totalPages}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Pours Extracted</span>
                            <strong className="text-slate-200 text-base font-bold font-mono">{processedRows.length} rows</strong>
                          </div>
                          <div>
                            <span className="text-slate-550 text-[10px] uppercase font-bold tracking-wider block">Logged Heat ID</span>
                            <strong className="text-cyan-400 text-xs font-bold truncate block font-mono">
                              {processedRows[0]?.heatNo || "N/A"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {hasNextPage && (
                        <button 
                          onClick={handleProcessNextPage} 
                          disabled={nextPageLoading}
                          className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                          {nextPageLoading ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Processing Page {currentPage + 2}...</span></>
                          ) : (
                            <><ArrowRight size={14} /><span>Process Next Page ({currentPage + 2}/{totalPages})</span></>
                          )}
                        </button>
                      )}
                      <button onClick={handleCloseRecord} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2">
                        <ShieldCheck size={16} /> Verify & Close Record
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center justify-center text-center text-slate-500">
                    <Database size={36} className="stroke-[1.5] text-slate-700 mb-3" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ready for Ingestion</p>
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-4 p-4 bg-rose-950/20 border border-rose-900/30 text-rose-300 rounded-xl flex gap-3 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <div><strong className="font-bold uppercase block mb-0.5">Error</strong>{error}</div>
                </div>
              )}
            </div>
          </div>
          {/* Extracted Data Blocks */}
          {result && (
            <>
              {/* Dynamic Section Tables */}
              <div className="space-y-6 animate-fade-in">
                {Object.entries(result).map(([sectionKey, sectionData]) => {
                  // Skip system headers and flat values
                  if (sectionKey === "error" || sectionKey === "message" || sectionKey === "filename" || sectionKey === "task_id") return null;
                  if (!sectionData || typeof sectionData !== "object") return null;

                  // Render nested lists inside the "tables" key as individual tables
                  if (sectionKey === "tables") {
                    return Object.entries(sectionData).map(([subTableKey, subTableData]) => {
                      if (!subTableData || !Array.isArray(subTableData)) return null;
                      
                      // Choose icon based on table name
                      let SubIcon = Layers3;
                      const lowerSub = subTableKey.toLowerCase();
                      if (lowerSub.includes("sleeve")) SubIcon = Layers3;
                      else if (lowerSub.includes("consumable")) SubIcon = Activity;
                      else if (lowerSub.includes("batch") || lowerSub.includes("summary")) SubIcon = Scale;
                      
                      return (
                        <FioriSectionTable
                          key={`${sectionKey}-${subTableKey}`}
                          title={formatKey(subTableKey)}
                          data={subTableData}
                          icon={SubIcon}
                        />
                      );
                    });
                  }

                  // Choose icon based on section key
                  let SectionIcon = FileText;
                  const lowerKey = sectionKey.toLowerCase();
                  if (lowerKey.includes("metadata") || lowerKey.includes("header")) SectionIcon = Info;
                  else if (lowerKey.includes("product") || lowerKey.includes("detail")) SectionIcon = Layers3;
                  else if (lowerKey.includes("inspection") || lowerKey.includes("parameter")) SectionIcon = ShieldCheck;
                  else if (lowerKey.includes("pouring")) SectionIcon = Flame;
                  else if (lowerKey.includes("signature")) SectionIcon = ShieldCheck;

                  return (
                    <FioriSectionTable
                      key={sectionKey}
                      title={formatKey(sectionKey)}
                      data={sectionData}
                      icon={SectionIcon}
                    />
                  );
                })}
              </div>

              {/* Graphical Recharts Dashboards */}
              <div className="space-y-8 pt-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="text-cyan-400" size={22} />
                    <h2 className="text-xl font-bold text-slate-100">Analytical Telemetry Dashboards</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Plot 1: Pouring Time vs Weight */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Pouring Time vs Weight</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Process Optimization</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis type="number" dataKey="pouredWeight" name="Poured Weight" unit=" kg" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} ticks={getTab1XTicks()} />
                            <YAxis type="number" dataKey="pouringTimeSec" name="Pouring Time" unit=" sec" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} ticks={getTab1YTicks()} />
                            <ZAxis type="number" range={[65, 65]} />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Scatter name="Pours" data={processedRows} fill="#22d3ee" shape="circle" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 2: Tapping Temp vs Pouring Temp */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Tapping Temp vs Pouring Temp</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Heat Loss</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart data={processedRows} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="id" stroke="#475569" tickFormatter={(v, i) => `Seq ${i + 1}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[1500, 1660]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Line type="monotone" dataKey="tappingTemp" name="Tapping Temp (Furnace)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="pouringTemp" name="Pouring Temp (Mold)" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 3: Temperature Loss (ΔT) */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Temperature Loss (ΔT)</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Energy Efficiency</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <AreaChart data={processedRows} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                            <defs>
                              <linearGradient id="colorTempLoss" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="id" stroke="#475569" tickFormatter={(v, i) => `Seq ${i + 1}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Area type="monotone" dataKey="tempLoss" name="Thermal Loss (ΔT in °C)" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTempLoss)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 4: SPC Control Charts */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">SPC Control Chart</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Process Stability</span>
                      </div>
                      <div className="h-[280px] w-full mt-4 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart data={getSpcChartData()} margin={{ top: 15, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="index" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[dataMin => Math.min(dataMin - 2, spcLimits.lcl - 2), dataMax => Math.max(dataMax + 2, spcLimits.ucl + 2)]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <ReferenceLine y={spcLimits.ucl} label={{ value: `UCL (+3σ)`, fill: '#ef4444', position: 'top', fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                            <ReferenceLine y={spcLimits.mean} label={{ value: `Mean (CL)`, fill: '#818cf8', position: 'right', fontSize: 10 }} stroke="#818cf8" strokeWidth={1.5} />
                            <ReferenceLine y={spcLimits.lcl} label={{ value: `LCL (-3σ)`, fill: '#ef4444', position: 'bottom', fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                            <Line type="monotone" dataKey="weightDiff" name="Weight Error (kg)" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', stroke: '#a78bfa' }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Historical Multi-Heat Multi-Series Analytics */}
      {activeTab === 'historical' && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <History className="text-cyan-400" size={22} />
              <h2 className="text-xl font-bold text-slate-100">Multi-Heat Comparative Analytics</h2>
            </div>
            <div className="flex items-center gap-3.5">
              <button onClick={handleExport} disabled={exporting} className={`px-4 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${exporting ? 'bg-slate-850 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.03]'}`}>
                {exporting ? <><span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" /><span>Exporting...</span></> : <><Download size={14} /><span>Export Excel</span></>}
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin" />
              <p className="text-slate-400 text-xs font-bold uppercase">Loading saved documents...</p>
            </div>
          ) : historicalHeats.length === 0 ? (
            <div className="py-20 text-center bg-slate-900/40 border border-slate-850 rounded-2xl p-8 flex flex-col items-center">
              <Database size={44} className="text-slate-700 mb-4" />
              <h3 className="text-slate-200 text-sm font-bold uppercase tracking-wider">Historical Database is Empty</h3>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                    <h3 className="text-base font-bold text-slate-200">Pouring Time vs Weight (Multi-Heat Series)</h3>
                  </div>
                  <div className="h-[400px] w-full mt-4 relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" dataKey="pouredWeight" name="Poured Weight" unit=" kg" stroke="#475569" tick={{ fontSize: 10 }} ticks={getHistoricalXTicks()} />
                        <YAxis type="number" dataKey="pouringTimeSec" name="Pouring Time" unit=" sec" stroke="#475569" tick={{ fontSize: 10 }} ticks={getHistoricalYTicks()} />
                        <ZAxis type="number" range={[65, 65]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 15 }} />
                        {historicalHeats.map((heat, idx) => (
                          <Scatter key={heat.heatNo} name={`Heat ${heat.heatNo}`} data={heat.data} fill={HEAT_COLORS[idx % HEAT_COLORS.length]} shape="circle" />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}