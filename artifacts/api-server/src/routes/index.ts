import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wikiRouter from "./wiki";
import mediaRouter from "./media";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wikiRouter);
router.use(mediaRouter);
router.use(aiRouter);

export default router;
