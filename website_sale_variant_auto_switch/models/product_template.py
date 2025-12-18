from odoo import models
import operator


class ProductTemplate(models.Model):
    _inherit = "product.template"

    def _find_auto_switch_combination(self, combination, parent_combination=False, product_id=False, changed_ptav_id=False):
        """
        Find the best valid combination when the requested one is invalid.
        This preserves user intent by scoring variants based on shared attributes.

        Called explicitly from controller, not automatically in _get_combination_info.

        Args:
            combination: The requested combination (recordset)
            parent_combination: Parent combination if applicable (recordset)
            product_id: Current product variant ID (0 for dynamic variants)
            changed_ptav_id: ID of the PTAV that was just changed (helps identify user intent for dynamic variants)
        """
        # If already valid, no need to switch
        if not combination or self._is_combination_possible(combination, parent_combination):
            return combination, product_id

        # Separate variant-creating from no_variant attributes
        variant_creating_attributes = combination._without_no_variant_attributes()
        custom_attributes = combination - variant_creating_attributes

        # Determine which attribute value was just picked
        anchor_attribute = None

        # Try to get from changed_ptav_id first (for dynamic variants or explicit tracking)
        if changed_ptav_id:
            requested_attribute = self.env['product.template.attribute.value'].browse(int(changed_ptav_id))
            # Verify it's in the combination and is variant-creating
            if requested_attribute in variant_creating_attributes:
                anchor_attribute = requested_attribute

        # Fallback to comparing with old variant (for regular variants without explicit tracking)
        if not anchor_attribute and product_id:
            current_variant = self.env['product.product'].browse(int(product_id))
            if current_variant and current_variant.product_template_attribute_value_ids:
                # Filter old variant's attributes to variant-creating only
                current_variant_attributes = current_variant.product_template_attribute_value_ids._without_no_variant_attributes()

                # The picked PTAV is the difference between new combo and old variant's attributes
                new_attribute_ids = list(
                    set(variant_creating_attributes.ids) - set(current_variant_attributes.ids)
                )

                if len(new_attribute_ids) >= 1:
                    anchor_attribute = self.env['product.template.attribute.value'].browse(new_attribute_ids[0])

        # If we identified the picked PTAV, find the best matching variant
        if anchor_attribute:
            # Build list of all desired attribute IDs
            desired_attribute_ids = variant_creating_attributes.ids

            # Single optimized query: Get variants with anchor attribute, scored by match count
            self.env.cr.execute('''
                SELECT
                    pp.id,
                    COUNT(CASE
                        WHEN pvc.product_template_attribute_value_id = ANY(%s)
                        THEN 1
                    END) as match_count
                FROM product_product pp
                INNER JOIN product_variant_combination pvc ON pvc.product_product_id = pp.id
                WHERE pp.product_tmpl_id = %s
                    AND pp.active = true
                    AND pp.id IN (
                        -- Subquery: Get only variants that have the anchor attribute
                        SELECT DISTINCT product_product_id
                        FROM product_variant_combination
                        WHERE product_template_attribute_value_id = %s
                    )
                GROUP BY pp.id
                ORDER BY match_count DESC
            ''', (desired_attribute_ids, self.id, anchor_attribute.id))

            ranked_results = self.env.cr.fetchall()

            if ranked_results:
                ranked_variant_ids = [row[0] for row in ranked_results]
                ranked_variants = self.env['product.product'].browse(ranked_variant_ids)

                # Find the first one that is possible
                for variant in ranked_variants:
                    variant_attributes = variant.product_template_attribute_value_ids

                    # Check variant combo is valid (ignoring no_variant for now)
                    if not self._is_combination_possible(variant_attributes, parent_combination, ignore_no_variant=True):
                        continue

                    # Add back no_variant attributes
                    complete_combination = variant_attributes | custom_attributes

                    # Check FULL combination is valid (including no_variant exclusions)
                    if self._is_combination_possible(complete_combination, parent_combination):
                        return complete_combination, variant.id

        # If no valid switch found, return original
        return combination, product_id
