from odoo import http
from odoo.http import request, route
from odoo.addons.website_sale.controllers.variant import WebsiteSaleVariantController


class AutoSwitchVariantController(WebsiteSaleVariantController):
    """
    Override to implement automatic variant switching only in interactive website context.
    This avoids affecting historical data (orders, invoices, reports, etc.).
    """

    @route()
    def get_combination_info_website(self, *args, **kwargs):
        """
        Override to perform automatic switching before calling parent method.
        Only runs for interactive website product pages, not for orders/reports.
        """
        # Extract parameters
        product_template_id = kwargs.get('product_template_id')
        product_id = kwargs.get('product_id')
        combination = kwargs.get('combination', [])
        changed_ptav_id = kwargs.get('changed_ptav_id', False)

        switched_combination_recordset = None

        if product_template_id and combination:
            # Get the product template
            product_template = request.env['product.template'].browse(int(product_template_id))

            # Convert combination IDs to recordset
            combination_recordset = request.env['product.template.attribute.value'].browse(combination)

            # Perform automatic switching if needed
            switched_combination_recordset, _switched_product_id = product_template._find_auto_switch_combination(
                combination_recordset,
                product_id,
                changed_ptav_id
            )

            # Update kwargs with switched combination. Keep the original product_id: core resolves
            # the variant from the combination, and flags `no_product_change` (skipping the image
            # refresh) when the returned variant equals the product_id it was given.
            kwargs['combination'] = switched_combination_recordset.ids

        # Get combination info from parent
        result = super().get_combination_info_website(*args, **kwargs)

        # Add frontend helper data for automatic switching
        if switched_combination_recordset:
            result.update({
                'ptav_ids': switched_combination_recordset.ids,
                'ptav_variant_ids': switched_combination_recordset._without_no_variant_attributes().ids,
            })

        return result
