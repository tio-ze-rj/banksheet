// banksheet web UI — vanilla JS

(function () {
  'use strict';

  // State
  let transactions = [];
  let sortCol = 'date';
  let sortAsc = true;
  let searchQuery = '';

  // DOM refs
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const browseLink = document.getElementById('browseLink');
  const progressBar = document.getElementById('progressBar');
  const parsersBar = document.getElementById('parsersBar');
  const errorMsg = document.getElementById('errorMsg');
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const toolbarInfo = document.getElementById('toolbarInfo');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('tableBody');
  const themeToggle = document.getElementById('themeToggle');

  // Theme
  function initTheme() {
    const saved = localStorage.getItem('banksheet-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  themeToggle.addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('banksheet-theme', next);
  });

  initTheme();

  // Load available parsers
  fetch('/api/parsers')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.parsers || data.parsers.length === 0) return;
      var html = '<span class="parsers-label">Supported:</span>';
      data.parsers.forEach(function (p) {
        html += '<span class="parser-tag">' + escapeHtml(p.name) + ' (' + escapeHtml(p.country) + ')</span>';
      });
      parsersBar.innerHTML = html;
    })
    .catch(function () { /* silent */ });

  // Upload handlers
  browseLink.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) uploadFile(fileInput.files[0]);
  });

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    var files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
  });

  // Upload & parse
  function uploadFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showError('Please upload a PDF file.');
      return;
    }

    hideError();
    results.classList.remove('visible');
    uploadZone.classList.add('processing');
    progressBar.style.width = '30%';

    var formData = new FormData();
    formData.append('pdf', file);
    var password = document.getElementById('pdfPassword').value;
    if (password) formData.append('password', password);

    fetch('/api/parse', { method: 'POST', body: formData })
      .then(function (r) {
        progressBar.style.width = '80%';
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Parse failed'); });
        return r.json();
      })
      .then(function (data) {
        progressBar.style.width = '100%';
        transactions = data.transactions;
        renderSummary(data);
        renderTable();
        results.classList.add('visible');
        setTimeout(function () {
          progressBar.style.width = '0%';
          uploadZone.classList.remove('processing');
        }, 400);
      })
      .catch(function (err) {
        progressBar.style.width = '0%';
        uploadZone.classList.remove('processing');
        showError(err.message);
      });

    // Reset input so same file can be re-uploaded
    fileInput.value = '';
  }

  // Summary
  function renderSummary(data) {
    var totalDebits = 0;
    var totalCredits = 0;
    data.transactions.forEach(function (t) {
      if (t.amount < 0) totalDebits += t.amount;
      else totalCredits += t.amount;
    });

    summary.innerHTML =
      card('Bank', escapeHtml(data.bank)) +
      card('Transactions', String(data.count)) +
      card('Total Debits', formatAmount(totalDebits, data.currency), totalDebits < 0 ? 'negative' : '') +
      card('Total Credits', formatAmount(totalCredits, data.currency), totalCredits > 0 ? 'positive' : '') +
      card('Net Total', formatAmount(data.total, data.currency), data.total < 0 ? 'negative' : 'positive');

    toolbarInfo.innerHTML = '<strong>' + data.count + '</strong> transactions from <strong>' + escapeHtml(data.bank) + '</strong>';
  }

  function card(label, value, cls) {
    return '<div class="summary-card"><div class="label">' + label + '</div><div class="value ' + (cls || '') + '">' + value + '</div></div>';
  }

  function getFilteredTransactions() {
    if (!searchQuery) return transactions;
    return transactions.filter(function (t) {
      return (
        t.description.toLowerCase().indexOf(searchQuery) !== -1 ||
        t.date.toLowerCase().indexOf(searchQuery) !== -1 ||
        String(t.amount).indexOf(searchQuery) !== -1 ||
        t.type.toLowerCase().indexOf(searchQuery) !== -1
      );
    });
  }

  // Table
  function renderTable() {
    var filtered = getFilteredTransactions();
    var sorted = filtered.slice().sort(comparator(sortCol, sortAsc));
    var html = '';
    sorted.forEach(function (t) {
      var amtClass = t.amount < 0 ? 'negative' : 'positive';
      html += '<tr>' +
        '<td class="col-date">' + escapeHtml(t.date) + '</td>' +
        '<td class="col-description">' + escapeHtml(t.description) + '</td>' +
        '<td class="col-amount ' + amtClass + '">' + formatAmount(t.amount, t.currency) + '</td>' +
        '<td class="col-type"><span class="type-badge ' + t.type + '">' + t.type + '</span></td>' +
        '</tr>';
    });
    tableBody.innerHTML = html;

    // Update header sort indicators
    document.querySelectorAll('thead th').forEach(function (th) {
      var col = th.getAttribute('data-col');
      th.classList.toggle('sorted', col === sortCol);
      var arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = (col === sortCol && !sortAsc) ? '▼' : '▲';
    });
  }

  // Sort
  document.querySelectorAll('thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-col');
      if (col === sortCol) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      renderTable();
    });
  });

  function comparator(col, asc) {
    return function (a, b) {
      var va, vb;
      if (col === 'amount') {
        va = a.amount; vb = b.amount;
      } else if (col === 'date') {
        va = a.date; vb = b.date;
      } else if (col === 'type') {
        va = a.type; vb = b.type;
      } else {
        va = a.description.toLowerCase(); vb = b.description.toLowerCase();
      }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    };
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTable();
    });
  }

  // Export
  document.querySelectorAll('[data-format]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var format = btn.getAttribute('data-format');
      var toExport = getFilteredTransactions();
      if (toExport.length === 0) return;

      fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: toExport, format: format }),
      })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Export failed'); });
          var filename = 'transactions.' + (format === 'excel' ? 'xlsx' : format);
          return r.blob().then(function (blob) { downloadBlob(blob, filename); });
        })
        .catch(function (err) { showError(err.message); });
    });
  });

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helpers
  function formatAmount(amount, currency) {
    var sign = amount < 0 ? '−' : '+';
    var abs = Math.abs(amount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign + ' ' + (currency || 'BRL') + ' ' + abs;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
  }

  function hideError() {
    errorMsg.classList.remove('visible');
  }
})();
