module.exports = [
    { method: "get", path: "/home", handler: "homeController.getCurrentPromotions" },
    { method: "get", path: "/", handler: "testController.getTesting" },
    // {
    //   method: "post",
    //   path: "/submit",
    //   handler: "formController.submitForm",
    // },
];
