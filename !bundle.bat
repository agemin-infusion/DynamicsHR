@echo off
@echo Bundling vendor JS
@type js\modernizr.min.js > ihr_vendor.min.js
@type js\jquery.min.js >> ihr_vendor.min.js
@type js\jquery-ui.min.js >> ihr_vendor.min.js
@type js\shield-ui.min.js >> ihr_vendor.min.js
@type js\slimscroll.min.js >> ihr_vendor.min.js
@type js\SDK.JQuery.min.js >> ihr_vendor.min.js
@type js\SDK.MetaData.min.js >> ihr_vendor.min.js
@type js\linq.min.js >> ihr_vendor.min.js
@type js\async.min.js >> ihr_vendor.min.js
@type js\knockout-3.0.0.min.js >> ihr_vendor.min.js
@type js\moment.min.js >> ihr_vendor.min.js
@type js\spin.min.js >> ihr_vendor.min.js
@type js\jquery.spin.min.js >> ihr_vendor.min.js

@echo Bundling HR Dashboard JS
@type js\HrDashboard.min.js > ihr_HrDashboard.min.js

@echo Bundling CSS
@type css\styles.min.css > ihr_styles.min.css
@pause