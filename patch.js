/* ============================================================
   PATCH.JS — Pembaikan Sistem Empayar S Kreatif v1.0
   Cara guna: Tambah <script src="patch.js"></script>
              SEBELUM </body> dalam index.html
   ============================================================ */
(function() {
    'use strict';
    console.log('🔧 [PATCH] Memulakan pembaikan sistem...');

    function waitForSystem(cb, maxWait) {
        maxWait = maxWait || 15000;
        var start = Date.now();
        function check() {
            if (window.supabase && window.QRCode && document.getElementById('landing-page')) {
                cb();
            } else if (Date.now() - start > maxWait) {
                console.error('❌ [PATCH] Sistem utama tak ready selepas ' + maxWait + 'ms');
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    }

    function getClient() {
        if (window.__patchClient) return window.__patchClient;
        window.__patchClient = window.supabase.createClient(
            'https://lgnbravmaqgdcgldkose.supabase.co',
            'sb_publishable_C4Vg3j2N-4u6Ro26RsoF7A_Nqh1oKSi'
        );
        return window.__patchClient;
    }

    function esc(s) {
        return (s || '').toString().replace(/[&<>"']/g, function(m) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
        });
    }

    function fmtDate(d) {
        if (!d || d === '-') return '-';
        try {
            var str = String(d).length === 10 ? d + 'T00:00:00' : d;
            var dt = new Date(str);
            if (isNaN(dt.getTime())) return '-';
            return String(dt.getDate()).padStart(2,'0') + '/' +
                   String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear();
        } catch(e) { return '-'; }
    }

    function fmtTime(d) {
        if (!d) return '-';
        try {
            var dt = new Date(d);
            if (isNaN(dt.getTime())) return '-';
            return String(dt.getDate()).padStart(2,'0') + '/' +
                   String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear() + ' ' +
                   String(dt.getHours()).padStart(2,'0') + ':' +
                   String(dt.getMinutes()).padStart(2,'0');
        } catch(e) { return '-'; }
    }

    var DESIGN_LABEL = {
        pending:'Pending', in_progress:'In Progress', sent_to_customer:'Hantar Pelanggan',
        revision:'Revision', confirmed:'Confirmed', completed:'Selesai'
    };
    var PROD_LABEL = { pending:'Pending', in_progress:'In Progress', paused:'Paused', done:'Siap' };

    function installAll() {

        // FIX 1: loadDesignActivityForDetail (fungsi hilang)
        window.loadDesignActivityForDetail = async function(inv) {
            var el = document.getElementById('design-activity-list');
            if (!el) return;
            try {
                var client = getClient();
                var res = await client.from('design_activity').select('*')
                    .eq('invoice_number', inv).order('created_at', {ascending:false});
                if (res.error) throw res.error;
                var act = res.data || [];
                if (!act.length) {
                    el.innerHTML = '<p style="color:#999;font-size:13px;">Tiada aktiviti design.</p>';
                    return;
                }
                el.innerHTML = act.map(function(a) {
                    var detail = '';
                    if (a.action === 'assigned') {
                        detail = 'Assigned kepada <strong>' + esc(a.new_status || a.designer_name) + '</strong>';
                    } else if (a.action === 'status_change') {
                        var o = DESIGN_LABEL[a.old_status] || a.old_status || '-';
                        var n = DESIGN_LABEL[a.new_status] || a.new_status || '-';
                        detail = 'Status: <strong>' + esc(o) + '</strong> → <strong>' + esc(n) + '</strong>';
                    } else if (a.action === 'reassigned') {
                        detail = '<strong>' + esc(a.old_status||'-') + '</strong> → <strong>' +
                                 esc(a.new_status||'-') + '</strong><br>Sebab: <em>' + esc(a.notes||'-') + '</em>';
                    } else if (a.action === 'notes_update') {
                        detail = 'Nota dikemaskini';
                    } else {
                        detail = esc(a.notes || a.action || '');
                    }
                    return '<div class="design-activity-item"><div class="log-header">' +
                           fmtTime(a.created_at) + ' - ' + esc(a.designer_name||'-') +
                           '</div><div class="log-detail">' + detail + '</div></div>';
                }).join('');
            } catch(e) {
                console.error('[PATCH] design activity:', e);
                el.innerHTML = '<p style="color:#e74c3c;font-size:13px;">❌ Gagal muat sejarah.</p>';
            }
        };
        console.log('   - loadDesignActivityForDetail ✓');

        // FIX 2: getProductionBadgeHtml helper
        window.getProductionBadgeHtml = function(status) {
            if (!status) return '<span class="production-status-badge" style="background:#ddd;color:#777;">Belum dihantar</span>';
            var map = {
                pending:{cls:'prod-pending',i:'🟡',l:'Pending'},
                in_progress:{cls:'prod-in_progress',i:'🔵',l:'In Progress'},
                paused:{cls:'prod-paused',i:'🟠',l:'Paused'},
                done:{cls:'prod-done',i:'✅',l:'Siap'}
            };
            var s = map[status] || map.pending;
            return '<span class="production-status-badge ' + s.cls + '">' + s.i + ' ' + s.l + '</span>';
        };

        // FIX 3: refreshProductionPanel (bug outerHTML)
        window.refreshProductionPanel = async function() {
            var o = window.__patchCurrentOrder;
            if (!o) return;
            try {
                var deptEl = document.getElementById('detail-production-dept');
                var assignEl = document.getElementById('detail-production-assigned');
                var notesEl = document.getElementById('detail-production-notes');
                if (deptEl) {
                    var d = (window.allDepartmentsCache || []).find(function(x){ return x.id === o.productionDepartment; });
                    deptEl.textContent = d ? d.name : '-';
                }
                if (assignEl) assignEl.textContent = o.productionAssignedTo || '-';
                if (notesEl) notesEl.value = o.productionNotes || '';
                var oldBadge = document.getElementById('detail-production-status-badge');
                if (oldBadge) {
                    var tmp = document.createElement('div');
                    tmp.innerHTML = window.getProductionBadgeHtml(o.productionStatus);
                    var nb = tmp.firstChild;
                    if (nb) {
                        nb.id = 'detail-production-status-badge';
                        oldBadge.parentNode.replaceChild(nb, oldBadge);
                    }
                }
                var sb = document.getElementById('btn-send-to-production');
                if (sb) sb.style.display = o.productionStatus ? 'none' : 'inline-block';
                if (window.loadProductionActivityForDetail) {
                    await window.loadProductionActivityForDetail(o.invoiceNumber);
                }
            } catch(e) { console.error('[PATCH] refreshProd:', e); }
        };
        console.log('   - refreshProductionPanel ✓');

        // FIX 4: loadProductionActivityForDetail backup
        if (!window.loadProductionActivityForDetail) {
            window.loadProductionActivityForDetail = async function(inv) {
                var el = document.getElementById('production-activity-list');
                if (!el) return;
                try {
                    var client = getClient();
                    var res = await client.from('production_activity').select('*')
                        .eq('invoice_number', inv).order('created_at', {ascending:false});
                    var data = res.data || [];
                    if (!data.length) {
                        el.innerHTML = '<p style="color:#999;font-size:13px;">Belum ada aktiviti.</p>';
                        return;
                    }
                    el.innerHTML = data.map(function(a) {
                        var oL = a.old_status ? (PROD_LABEL[a.old_status] || a.old_status) : '-';
                        var nL = a.new_status ? (PROD_LABEL[a.new_status] || a.new_status) : '-';
                        var d = '';
                        if (a.action === 'sent') d = esc(a.notes || 'Dihantar');
                        else if (a.action === 'start') d = 'Mula: <strong>' + oL + '</strong> → <strong>' + nL + '</strong>';
                        else if (a.action === 'paused') d = 'Pause: <strong>' + oL + '</strong> → <strong>' + nL + '</strong><br>Nota: <em>' + esc(a.notes||'-') + '</em>';
                        else if (a.action === 'resumed') d = 'Resume: <strong>' + oL + '</strong> → <strong>' + nL + '</strong>';
                        else if (a.action === 'done') d = 'Siap: <strong>' + nL + '</strong> ✅';
                        else d = esc(a.notes || a.action || '');
                        return '<div class="production-activity-item"><div class="log-header">' +
                               fmtTime(a.created_at) + ' — ' + esc(a.staff_name||'-') +
                               '</div><div class="log-detail">' + d + '</div></div>';
                    }).join('');
                } catch(e) {
                    el.innerHTML = '<p style="color:#e74c3c;font-size:13px;">Gagal muat aktiviti.</p>';
                }
            };
        }
        console.log('   - loadProductionActivityForDetail ✓');

        // FIX 5: updateOrderWithLog (guard undefined)
        window.updateOrderWithLog = async function(newOrder, oldOrder) {
            try {
                var client = getClient();
                var updateData = {
                    customer_name: newOrder.customerName,
                    customer_phone: newOrder.customerPhone,
                    order_date: newOrder.orderDate === '-' ? null : newOrder.orderDate,
                    completion_date: newOrder.completionDate === '-' ? null : newOrder.completionDate,
                    sales_person: newOrder.salesPerson,
                    total_amount: newOrder.totalAmount,
                    discount: newOrder.discount,
                    subtotal: newOrder.subtotal,
                    deposit: newOrder.deposit,
                    balance: newOrder.balance,
                    status: newOrder.status,
                    payment_info: newOrder.paymentInfo || null
                };
                var dbMap = {
                    assignedDesigner:'assigned_designer', designStatus:'design_status',
                    designNotes:'design_notes', designUpdatedAt:'design_updated_at',
                    designUpdatedBy:'design_updated_by', productionDepartment:'production_department',
                    productionStatus:'production_status', productionNotes:'production_notes',
                    productionAssignedTo:'production_assigned_to', productionUpdatedAt:'production_updated_at',
                    productionUpdatedBy:'production_updated_by', deliveryMethod:'delivery_method',
                    deliveryAddress:'delivery_address', deliveryDate:'delivery_date',
                    deliveredAt:'delivered_at', deliveredBy:'delivered_by',
                    completedBy:'completed_by', completedAt:'completed_at',
                    completedPinVerified:'completed_pin_verified', incompleteNote:'incomplete_note',
                    incompleteNoteUpdatedAt:'incomplete_note_updated_at',
                    incompleteNoteUpdatedBy:'incomplete_note_updated_by', isQuotation:'is_quotation',
                    quotationValidUntil:'quotation_valid_until',
                    convertedToOrderAt:'converted_to_order_at',
                    convertedToOrderBy:'converted_to_order_by',
                    originalQuotationNumber:'original_quotation_number', quotationNotes:'quotation_notes'
                };
                Object.keys(dbMap).forEach(function(key) {
                    if (newOrder[key] !== undefined) {
                        updateData[dbMap[key]] = newOrder[key];
                    }
                });
                var res = await client.from('orders').update(updateData).eq('invoice_number', newOrder.invoiceNumber);
                if (res.error) throw res.error;
                var r = await client.from('orders').select('id').eq('invoice_number', newOrder.invoiceNumber).single();
                if (r.data && newOrder.items) {
                    await client.from('order_items').delete().eq('order_id', r.data.id);
                    if (newOrder.items.length) {
                        await client.from('order_items').insert(newOrder.items.map(function(it) {
                            return {order_id:r.data.id, description:it.description, price:it.price, quantity:it.quantity, total:it.total};
                        }));
                    }
                }
                if (oldOrder) {
                    var changes = [];
                    function addC(f, ov, nv) {
                        if (String(ov||'') !== String(nv||'')) changes.push({f:f, o:ov, n:nv});
                    }
                    addC('Nama Pelanggan', oldOrder.customerName, newOrder.customerName);
                    addC('Telefon', oldOrder.customerPhone, newOrder.customerPhone);
                    addC('Tarikh Order', fmtDate(oldOrder.orderDate), fmtDate(newOrder.orderDate));
                    addC('Tarikh Siap', fmtDate(oldOrder.completionDate), fmtDate(newOrder.completionDate));
                    if (Math.abs((oldOrder.discount||0) - (newOrder.discount||0)) > 0.01) {
                        changes.push({f:'Diskaun', o:'RM'+(oldOrder.discount||0).toFixed(2), n:'RM'+(newOrder.discount||0).toFixed(2)});
                    }
                    if (Math.abs((oldOrder.deposit||0) - (newOrder.deposit||0)) > 0.01) {
                        changes.push({f:'Deposit', o:'RM'+(oldOrder.deposit||0).toFixed(2), n:'RM'+(newOrder.deposit||0).toFixed(2)});
                    }
                    addC('Status', oldOrder.status, newOrder.status);
                    addC('Jurujual', oldOrder.salesPerson, newOrder.salesPerson);
                    for (var i = 0; i < changes.length; i++) {
                        try {
                            await client.from('audit_logs').insert({
                                invoice_number: newOrder.invoiceNumber,
                                staff_name: window.STAFF_NAME || 'Unknown',
                                action: 'update',
                                field_changed: changes[i].f,
                                old_value: changes[i].o ? String(changes[i].o) : null,
                                new_value: changes[i].n ? String(changes[i].n) : null
                            });
                        } catch(e) {}
                    }
                }
                return true;
            } catch(e) {
                console.error('[PATCH] updateOrder:', e);
                return false;
            }
        };
        console.log('   - updateOrderWithLog (guard) ✓');

        // FIX 6: executeConvertQuotation (jangan padam quotation)
        window.executeConvertQuotation = async function() {
            var oldQ = window.__patchConvertQuotation;
            if (!oldQ) return;
            var modal = document.getElementById('convert-quotation-modal');
            var newInv = document.getElementById('convert-new-invoice-number').value;
            var newComp = document.getElementById('convert-completion-date').value;
            var newDep = parseFloat(document.getElementById('convert-deposit').value) || 0;
            var notes = document.getElementById('convert-notes').value.trim();
            var errEl = document.getElementById('convert-error');
            if (!newInv) {
                errEl.textContent = 'Sila pilih no. bil.';
                errEl.style.display = 'block';
                return;
            }
            var client = getClient();
            var newBal = (oldQ.subtotal || 0) - newDep;
            try {
                var oi = await client.from('order_items').select('*').eq('order_id', oldQ.id);
                var savedItems = (oi.data || []).map(function(it) {
                    return {description:it.description, price:parseFloat(it.price)||0, quantity:it.quantity, total:parseFloat(it.total)||0};
                });
                // TIDAK padam quotation — hanya mark converted
                await client.from('orders').update({
                    converted_to_order_at: new Date().toISOString(),
                    converted_to_order_by: window.STAFF_NAME || 'Unknown',
                    quotation_notes: notes || oldQ.quotationNotes || null
                }).eq('invoice_number', oldQ.invoiceNumber);
                var ins = {
                    invoice_number: newInv,
                    customer_name: oldQ.customerName, customer_phone: oldQ.customerPhone,
                    order_date: oldQ.orderDate, completion_date: newComp || oldQ.completionDate,
                    sales_person: oldQ.salesPerson, total_amount: oldQ.totalAmount,
                    discount: oldQ.discount, subtotal: oldQ.subtotal, deposit: newDep, balance: newBal,
                    status: 'normal', created_by: window.STAFF_NAME || 'Unknown',
                    is_quotation: false, converted_to_order_at: new Date().toISOString(),
                    converted_to_order_by: window.STAFF_NAME || 'Unknown',
                    original_quotation_number: oldQ.invoiceNumber, quotation_notes: notes || null
                };
                if (oldQ.assignedDesigner) {
                    ins.assigned_designer = oldQ.assignedDesigner;
                    ins.design_status = 'pending';
                    ins.design_updated_at = new Date().toISOString();
                    ins.design_updated_by = window.STAFF_NAME;
                }
                if (oldQ.designNotes) ins.design_notes = oldQ.designNotes;
                if (oldQ.deliveryMethod) ins.delivery_method = oldQ.deliveryMethod;
                if (oldQ.deliveryAddress) ins.delivery_address = oldQ.deliveryAddress;
                if (oldQ.deliveryDate) ins.delivery_date = oldQ.deliveryDate;
                var nr = await client.from('orders').insert(ins).select().single();
                if (nr.error) throw nr.error;
                if (savedItems.length) {
                    await client.from('order_items').insert(savedItems.map(function(it) {
                        return {order_id:nr.data.id, description:it.description, price:it.price, quantity:it.quantity, total:it.total};
                    }));
                }
                try {
                    await client.from('audit_logs').insert({
                        invoice_number: newInv,
                        staff_name: window.STAFF_NAME || 'Unknown',
                        action: 'create',
                        notes: 'Order dari Quotation ' + oldQ.invoiceNumber + '. Deposit: RM' + newDep
                    });
                } catch(e) {}
                modal.style.display = 'none';
                window.__patchConvertQuotation = null;
                alert('✅ Quotation ' + oldQ.invoiceNumber + ' berjaya convert ke Order ' + newInv + '!\n\nQuotation asal dikekalkan untuk rekod.');
                if (window.displayQuotations) window.displayQuotations();
                if (window.displayOrders) window.displayOrders();
            } catch(e) {
                console.error('[PATCH] convert:', e);
                errEl.textContent = '❌ Gagal: ' + e.message;
                errEl.style.display = 'block';
            }
        };
        console.log('   - executeConvertQuotation (no data loss) ✓');

        // FIX 7: Hook openConvertQuotationModal
        if (typeof window.openConvertQuotationModal === 'function') {
            var origOpen = window.openConvertQuotationModal;
            window.openConvertQuotationModal = async function(o) {
                window.__patchConvertQuotation = o;
                try { return await origOpen(o); }
                catch(e) { console.error('[PATCH] openConvert:', e); }
            };
        }
        console.log('   - openConvertQuotationModal (hook) ✓');

        // FIX 8: formatDate/formatTime timezone-safe
        window.formatDate = fmtDate;
        window.formatTime = fmtTime;
        console.log('   - formatDate/formatTime ✓');

        // FIX 9: applyUIConfig badge fix
        if (typeof window.applyUIConfig === 'function') {
            var origApply = window.applyUIConfig;
            window.applyUIConfig = function() {
                try { origApply(); } catch(e) {}
                try {
                    var UC = window.UI_CONFIG;
                    if (!UC || !UC.text) return;
                    var map = {
                        'tab-invoice':'tab_invoice','tab-orders':'tab_orders','tab-active':'tab_active',
                        'tab-quotation':'tab_quotation','tab-design':'tab_design','tab-production':'tab_production',
                        'tab-dashboard':'tab_dashboard','tab-sales-person':'tab_sales_person',
                        'tab-templates':'tab_templates','tab-deleted-bills':'tab_deleted_bills','tab-settings':'tab_settings'
                    };
                    Object.keys(map).forEach(function(tabId) {
                        var btn = document.getElementById(tabId);
                        if (!btn) return;
                        var k = map[tabId];
                        if (!UC.text[k]) return;
                        var badge = btn.querySelector('.badge-notif');
                        btn.innerHTML = '';
                        btn.appendChild(document.createTextNode(UC.text[k]));
                        if (badge) btn.appendChild(badge);
                    });
                } catch(e) {}
            };
        }
        console.log('   - applyUIConfig (badge fix) ✓');

        // FIX 10: submitAndPrint lock cleanup
        if (typeof window.submitAndPrint === 'function') {
            var origSubmit = window.submitAndPrint;
            window.submitAndPrint = async function() {
                try {
                    return await origSubmit();
                } catch(e) {
                    console.error('[PATCH] submitAndPrint:', e);
                    try {
                        var client = getClient();
                        var inv = document.getElementById('invoice-number') && document.getElementById('invoice-number').value;
                        if (client && inv) {
                            await client.from('invoice_locks').delete().eq('invoice_number', inv);
                        }
                    } catch(ce) {}
                    alert('Ralat: ' + e.message + '\n\nLock no. bil telah dibersihkan.');
                }
            };
        }
        console.log('   - submitAndPrint (lock cleanup) ✓');

        // FIX 11: executeQuickComplete guard tarikh masa depan
        if (typeof window.executeQuickComplete === 'function') {
            var origQC = window.executeQuickComplete;
            window.executeQuickComplete = async function() {
                try {
                    var dateEl = document.getElementById('qc-date');
                    if (dateEl && dateEl.value) {
                        var selD = new Date(dateEl.value + 'T00:00:00');
                        var tod = new Date();
                        tod.setHours(0,0,0,0);
                        if (selD > tod) {
                            if (!confirm('⚠️ Tarikh serah adalah MASA DEPAN. Teruskan?')) return;
                        }
                    }
                    return await origQC();
                } catch(e) {
                    console.error('[PATCH] QC:', e);
                    alert('Ralat: ' + e.message);
                }
            };
        }
        console.log('   - executeQuickComplete (guard) ✓');

        // FIX 12: escapeHtml tambah backtick
        window.escapeHtml = function(s) {
            return (s || '').toString().replace(/[&<>"'`]/g, function(m) {
                return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m];
            });
        };
        console.log('   - escapeHtml (backtick) ✓');

        // FIX 13: normalizePhone
        window.normalizePhone = function(phone, cc) {
            if (!phone) return '';
            cc = cc || '60';
            var p = String(phone).replace(/[^0-9]/g, '');
            if (!p) return '';
            if (p.startsWith('0')) p = p.substring(1);
            if (p.startsWith(cc)) p = p.substring(cc.length);
            return cc + p;
        };
        console.log('   - normalizePhone ✓');

        // FIX 14: Hook showOrderDetail
        if (typeof window.showOrderDetail === 'function') {
            var origShow = window.showOrderDetail;
            window.showOrderDetail = async function(o) {
                window.__patchCurrentOrder = o;
                try { return await origShow(o); }
                catch(e) {
                    console.error('[PATCH] showOrderDetail:', e);
                    alert('Ralat buka detail: ' + e.message);
                }
            };
        }
        console.log('   - showOrderDetail (hook) ✓');

        // FIX 15: Hook openQuickCompleteModal
        if (typeof window.openQuickCompleteModal === 'function') {
            var origQC2 = window.openQuickCompleteModal;
            window.openQuickCompleteModal = function(o) {
                window.__patchQuickCompleteOrder = o;
                try { return origQC2(o); }
                catch(e) { console.error('[PATCH] openQC:', e); }
            };
        }
        console.log('   - openQuickCompleteModal (hook) ✓');

        console.log('✅ [PATCH] Semua fix telah dipasang');
    }

    waitForSystem(installAll);
})();
