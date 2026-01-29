module.exports = [
    { method: "get", path: "/currentpro", handler: "currentPromo.getCurrentPromotions" },
    { method: "get", path: "/checkimei", handler: "searchPromo.getCheckIMEI" },
    // {
    //   method: "post",
    //   path: "/submit",
    //   handler: "formController.submitForm",
    // },
];
