/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { WebsiteSale } from '@website_sale/interactions/website_sale';
import VariantMixin from '@website_sale/js/variant_mixin';
import wSaleUtils from '@website_sale/js/website_sale_utils';

/**
 * Automatic Variant Switching - Auto-switch to valid combinations
 *
 * Extends WebsiteSale to automatically switch to valid product variants
 * instead of showing "This combination does not exist" errors.
 */
patch(WebsiteSale.prototype, {
    /**
     * Store the last changed event for use in _getOptionalCombinationInfoParam
     * @override
     */
    _getCombinationInfo(ev) {
        this._lastVariantChangeEvent = ev;
        return super._getCombinationInfo(...arguments);
    },

    /**
     * @override
     * Hook to pass changed_ptav_id to backend for automatic switching
     * This is the cleanest way - uses Odoo's built-in extension point
     */
    _getOptionalCombinationInfoParam(product) {
        const params = super._getOptionalCombinationInfoParam(...arguments);

        // Extract the changed PTAV ID from the last event
        let changedPtavId = null;
        if (this._lastVariantChangeEvent) {
            const target = this._lastVariantChangeEvent.target;

            if (target.classList.contains('js_variant_change')) {
                // For radios/checkboxes, get value directly
                changedPtavId = parseInt(target.value);
            } else if (target.tagName === 'SELECT') {
                // For select elements
                changedPtavId = parseInt(target.value);
            }
        }

        return {
            ...params,
            changed_ptav_id: changedPtavId,
        };
    },

    /**
     * @override
     */
    _onChangeCombination(ev, parent, combination) {
        super._onChangeCombination(...arguments);
        this._onChangeCombinationAutoSwitch(ev, parent, combination);
    },

    /**
     * Auto-switch: If backend returned a different combination, update UI
     */
    _onChangeCombinationAutoSwitch(ev, parent, combination) {
        // Store the backend's actual combination for use in _checkExclusions
        // This fixes the stale combination issue
        parent.dataset.ptavIds = JSON.stringify(combination.ptav_ids || []);
        parent.dataset.ptavVariantIds = JSON.stringify(combination.ptav_variant_ids || []);

        // Auto-switch: If backend returned a different combination, update UI
        if (combination.ptav_ids && Array.isArray(combination.ptav_ids)) {
            const selectedValues = wSaleUtils.getSelectedAttributeValues(parent);
            const selectedSet = new Set(selectedValues.map(v => parseInt(v)));
            const comboSet = new Set(combination.ptav_ids);

            // Check if combinations differ (backend switched to valid one)
            const isDifferent = selectedSet.size !== comboSet.size ||
                               [...selectedSet].some(v => !comboSet.has(v));

            if (isDifferent) {
                // Update UI to match backend's valid combination
                combination.ptav_ids.forEach(ptavId => {
                    let input = parent.querySelector(`input.js_variant_change[value="${ptavId}"]`);

                    if (input && input.type === 'radio') {
                        const radioName = input.name;

                        // Uncheck all radios in this group
                        parent.querySelectorAll(`input[name="${radioName}"]`).forEach(radio => {
                            radio.checked = false;
                        });

                        // Check the selected one
                        input.checked = true;

                    } else if (!input) {
                        // Handle select options
                        const option = parent.querySelector(`option[value="${ptavId}"]`);
                        if (option) {
                            option.selected = true;
                        }
                    }
                });

                // Sync active classes for all display types following Odoo 19's patterns
                // Pills: onChangePillsAttribute (website_sale.js:515-530)
                parent.querySelectorAll('.o_variant_pills').forEach(el => {
                    if (el.matches(':has(input:checked)')) {
                        el.classList.add('active', 'border-primary', 'text-primary-emphasis', 'bg-primary-subtle');
                    } else {
                        el.classList.remove('active', 'border-primary', 'text-primary-emphasis', 'bg-primary-subtle');
                    }
                });

                // Color: onChangeColorAttribute (website_sale.js:480-491)
                parent.querySelectorAll('.css_attribute_color').forEach(el => {
                    el.classList.toggle('active', el.matches(':has(input:checked)'));

                    // Update attribute value text (line 486-490 of base code)
                    const checkedInput = el.querySelector('input:checked');
                    if (checkedInput) {
                        const attrValueEl = el.closest('.variant_attribute')?.querySelector('.attribute_value');
                        if (attrValueEl && checkedInput.dataset.valueName) {
                            attrValueEl.innerText = checkedInput.dataset.valueName;
                        }
                    }
                });

                // Image: onChangeImageAttribute (website_sale.js:498-513)
                parent.querySelectorAll('label[name="o_wsale_attribute_image_selector"]').forEach(el => {
                    const input = el.querySelector('input');
                    if (input && input.checked) {
                        el.classList.add('active');

                        // Update attribute value text (line 508-512 of base code)
                        const attrValueEl = input.closest('[name="variant_attribute"]')?.querySelector('[name="attribute_value"]');
                        if (attrValueEl && input.dataset.valueName) {
                            attrValueEl.innerText = input.dataset.valueName;
                        }
                    } else {
                        el.classList.remove('active');
                    }
                });
            }
        }
    },

    /**
     * @override
     * Fixes:
     * 1. Stale combination bug - use backend's actual combination after automatic switching
     * 2. No_variant bug - pass variant-only combination to avoid Odoo issues with archived combinations
     */
    _checkExclusions(parent, combination) {
        // Use backend's actual combination after automatic switching (fixes stale combination)
        const ptavIds = parent.dataset.ptavIds;
        const actualCombination = ptavIds ? JSON.parse(ptavIds) : combination;

        // Pass variant-only combination to super() (workaround for Odoo no_variant bug)
        const ptavVariantIds = parent.dataset.ptavVariantIds;
        const variantOnlyCombination = ptavVariantIds ? JSON.parse(ptavVariantIds) : actualCombination;

        // Let Odoo handle invalid styling with correct combination
        super._checkExclusions(parent, variantOnlyCombination);
    },

    /**
     * @override
     * Fix Odoo core bug: parent scope too broad, querySelector finds wrong inputs.
     *
     * Issue: parent = .js_main_product contains hidden inputs (product_category_id value="1")
     * When disabling Steel (ptav value="1"), `input[value="1"]` finds hidden input first ❌
     *
     * Solution: Narrow scope to ul.js_add_cart_variants before calling super
     * Future-proof: If Odoo fixes selector, this still works via fallback
     */
    _disableInput(parent, attributeValueId, excludedBy, attributeNames, productName) {
        // Narrow scope to variant container to avoid finding unrelated inputs with same value
        const variantContainer = parent.querySelector('ul.js_add_cart_variants');
        const scopedParent = variantContainer || parent; // Fallback if container not found

        // Call original with scoped parent
        super._disableInput(scopedParent, attributeValueId, excludedBy, attributeNames, productName);
    },
});
