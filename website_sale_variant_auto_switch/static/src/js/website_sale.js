/** @odoo-module **/

import { WebsiteSale } from '@website_sale/js/website_sale';
import VariantMixin from "@website_sale/js/sale_variant_mixin";

/**
 * Automatic Variant Switching - Auto-switch to valid combinations
 */
VariantMixin._onChangeCombinationAutoSwitch = function (ev, $parent, combination) {
    // Store the backend's actual combination for use in _checkExclusions
    // This fixes the stale combination issue without overriding _getCombinationInfo
    $parent.data('ptav_ids', combination.ptav_ids || []);
    $parent.data('ptav_variant_ids', combination.ptav_variant_ids || []);

    // Auto-switch: If backend returned a different combination, update UI
    if (combination.ptav_ids && Array.isArray(combination.ptav_ids)) {
        const selectedValues = this.getSelectedVariantValues($parent);
        const selectedSet = new Set(selectedValues.map(v => parseInt(v)));
        const comboSet = new Set(combination.ptav_ids);

        // Check if combinations differ (backend switched to valid one)
        const isDifferent = selectedSet.size !== comboSet.size ||
                           [...selectedSet].some(v => !comboSet.has(v));

        if (isDifferent) {
            // Update UI to match backend's valid combination
            combination.ptav_ids.forEach(ptavId => {
                let $input = $parent.find(`input.js_variant_change[value="${ptavId}"]`);

                if ($input.length > 0 && $input.is('input[type="radio"]')) {
                    const radioName = $input.attr('name');

                    // Uncheck all radios in this group
                    $parent.find(`input[name="${radioName}"]`).prop('checked', false);

                    // Check the selected one
                    $input.prop('checked', true);

                } else {
                    // Handle select options
                    $input = $parent.find(`option[value="${ptavId}"]`);
                    if ($input.length > 0) {
                        $input.prop('selected', true);
                    }
                }
            });

            // Sync active classes for all display types (pills, color, radio)
            // Following Odoo's pattern from _onChangePillsAttribute and _onChangeColorAttribute
            $parent.find('.o_variant_pills')
                .removeClass('active')
                .filter(':has(input:checked)')
                .addClass('active');

            $parent.find('.css_attribute_color')
                .removeClass('active')
                .filter(':has(input:checked)')
                .addClass('active');
        }
    }
};

WebsiteSale.include({
    /**
     * Store the last changed event for use in _getOptionalCombinationInfoParam
     */
    _getCombinationInfo: function (ev) {
        this._lastVariantChangeEvent = ev;
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     * Hook to pass changed_ptav_id to backend for automatic switching
     * This is the cleanest way - uses Odoo's built-in extension point
     */
    _getOptionalCombinationInfoParam: function ($product) {
        const params = this._super.apply(this, arguments);

        // Extract the changed PTAV ID from the last event
        let changedPtavId = null;
        if (this._lastVariantChangeEvent) {
            const $target = $(this._lastVariantChangeEvent.target);

            if ($target.hasClass('js_variant_change')) {
                // For radios/checkboxes, get value directly
                changedPtavId = parseInt($target.val());
            } else if ($target.is('select')) {
                // For select elements
                changedPtavId = parseInt($target.val());
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
    _onChangeCombination: function () {
        this._super.apply(this, arguments);
        VariantMixin._onChangeCombinationAutoSwitch.apply(this, arguments);
    },

    /**
     * @override
     * Fixes:
     * 1. Stale combination bug - use backend's actual combination after automatic switching
     * 2. No_variant bug - pass variant-only combination to avoid Odoo issues with archived combinations
     */
    _checkExclusions: function ($parent, combination, parentExclusions) {
        // Use backend's actual combination after automatic switching (fixes stale combination)
        const actualCombination = $parent.data('ptav_ids') || combination;

        // Pass variant-only combination to super() (workaround for Odoo no_variant bug)
        const variantOnlyCombination = $parent.data('ptav_variant_ids') || actualCombination;

        // Let Odoo handle invalid styling with correct combination
        this._super($parent, variantOnlyCombination, parentExclusions);
    },

    /**
     * @override
     * Fix Odoo core bug: parent scope too broad, querySelector finds wrong inputs.
     *
     * Issue: $parent = .js_main_product contains hidden inputs (product_category_id value="1")
     * When disabling Steel (ptav value="1"), `input[value="1"]` finds hidden input first ❌
     *
     * Solution: Narrow scope to ul.js_add_cart_variants before calling super
     * Future-proof: If Odoo fixes selector, this still works via fallback
     */
    _disableInput: function ($parent, attributeValueId, excludedBy, attributeNames, productName) {
        // Narrow scope to variant container to avoid finding unrelated inputs with same value
        const $variantContainer = $parent.find('ul.js_add_cart_variants');
        const $scopedParent = $variantContainer.length > 0 ? $variantContainer : $parent; // Fallback if container not found

        // Call original with scoped parent
        this._super($scopedParent, attributeValueId, excludedBy, attributeNames, productName);
    },
});

export default WebsiteSale;
