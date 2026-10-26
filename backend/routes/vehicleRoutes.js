const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const vehicleController = require("../controllers/vehicleController");

const router = express.Router();

router.use(authMiddleware);
router.post("/", vehicleController.createVehicle);
router.get("/my", vehicleController.getMyVehicles);
router.get("/:id", vehicleController.getVehicle);
router.put("/:id", vehicleController.updateVehicle);
router.delete("/:id", vehicleController.deleteVehicle);

module.exports = router;
