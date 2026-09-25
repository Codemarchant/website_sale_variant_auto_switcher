{
    'name': 'Website Sale Variant Auto Switcher',
    'version': '20.0.1.0.0',
    'category': 'Website/Website',
    'summary': '''Automatically switch to valid product variants instead of showing errors.
    combination not found, invalid combination, this combination does not exist, variant error, variant not available,
    product variants, product attributes, attribute combinations, variant selection, variant switcher, auto switch,
    ecommerce, e-commerce, webshop, online store, website sale, product configurator, product options,
    amazon style, shopify style, smart variant, intelligent variant, variant ux, variant user experience,
    cart abandonment, conversion rate, checkout optimization, customer experience, shopping experience,
    exclude for, exclusion rules, archived variants, dynamic variants, variant matrix, attribute exclusion,
    woocommerce alternative, magento alternative, prestashop alternative, bigcommerce alternative,
    odoo ecommerce, odoo webshop, odoo variant, odoo product, odoo website sale, odoo shop,
    odoo20, odoo 20, odoo19, odoo 19, odoo18, odoo 18, odoo17, odoo 17''',
    'description': """
        Automatic Variant Switching
        ============================

        Enhances the eCommerce user experience by automatically switching to valid
        product combinations instead of showing "This combination does not exist" errors.

        Key Features:
        -------------
        • **Amazon-like variant selection**: Automatically switches to the closest valid
          combination when customers select incompatible attributes

        • **Preserves customer intent**: Intelligent algorithm keeps as many of the
          customer's original selections as possible

        • **Works with all variant creation modes**: Supports 'always' variants,
          'dynamic' variants (when created), and respects 'never' (no_variant) attributes

        • **Seamless integration**: Works with Odoo's built-in exclusion indicators and
          all standard themes without custom styling

        • **Zero configuration**: Activates automatically after installation

        • **Safe implementation**: Only affects interactive product pages, never touches
          orders or historical data

        Perfect for stores with:
        ------------------------
        • Products with multiple attribute combinations
        • Complex variant exclusion rules ("Exclude for" settings)
        • Archived variants to disable certain combinations
        • High variant count requiring advanced UX

        Results:
        --------
        ✓ Reduced cart abandonment
        ✓ Improved conversion rates
        ✓ Professional customer experience matching major eCommerce platforms
    """,
    'author': 'Codemarchant',
    'website': 'https://codemarchant.com',
    'support': 'support@codemarchant.com',
    'depends': ['website_sale'],
    'data': [
    ],
    'assets': {
        'web.assets_frontend': [
            'website_sale_variant_auto_switch/static/src/js/website_sale.js',
        ],
    },
    'images': [
        'static/description/banner.png',
    ],
    'price': 0,
    'currency': 'EUR',
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}