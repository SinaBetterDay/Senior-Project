import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import {prisma} from "../../lib/prisma.js";
import {requireAdmin} from "../../lib/auth.js";
import { parseScheduleA } from "../..parsers/scheduleA.js";
import { parseScheduleB } from "../..parsers/scheduleB.js";
import { parseScheduleCDE } from "../..parsers/scheduleCDE.js";
import { archiveWorkbook } from "../..lib/storgae.js";

const router = express.Router();
const upload = multer({storage: multer.memoryStorage()});

const XLSX_MIME = 
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    function hasRecognizableForm700Sheets(sheetNames = []){
        return sheetNames.some((name) => {
            const normalized = String(name).trim().toLowerCase();
            return (
                normalized.includes("cover page") ||
                normalized.includes("schedule a") ||
                normalized.includes("schedule b") ||
                normalized.includes("schedule c") ||
                normalized.includes("schedule d") ||
                normalized.includes("schedule e") 
            );
        });
    
    
        }
    function isDuplicateError(error) {
        return error?.code === "P2002" || error?.message?.toLowerCase().includes("duplicate");

    }

    router.post("/form700", requireAdmin, upload.single("file"), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({error: "Missing XLSX upload"});
            }

            if(req.file.mimetype !== XLSX_MIME) {
                return res.status(400).json({
                    error:
                    "Invalid file type. Expected application / vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                });
    
            }

            let workbook;
            try {
                workbook = XLSX.read(req.file.buffer, {type: "buffer"});
            } catch {
                return res.status(400).json({
                    error: "Uploaded file is not a valid XLSX workbook";
                });
            }

            
            if (!hasRecognizableForm700Sheets(workbook.SheetNames)) {
                return res.status(400).json( {
                    error: "Workbook does not contain any recognizable Form 700 sheet names"
                });
            }

            const politicianId = Number(req.body.politician_id);
            if (!Number.isInteger(politicianId) || politicianId <= 0) {
                return res.status(400).json({ error: "Missing or invalid politician_id"});
            }

            try {
                const summary = await prisma.$transaction(async(tx) => {
                    const politician = await tx.politician.findUnique({
                        where: {id: politicianId}
                    });
                
                    if (!politician) {
                        const error = new Error ("Politician not found");
                        error.statusCode = 400;
                        throw error;

                    }

                    const filing = await tx.form700Filing.create ({
                        data: {
                            politicianId,
                            originalFilename: req.file.originalname,
                            mimeType: req.file.mimetype
                        }
                    });

                    const parsedA = await parseScheduleA(workbook, filing.id, tx);
                    const parsedB = await parseScheduleB(workbook, filing.id, tx);
                    const parsedCDE = await parseScheduleCDE(workbook, filing.id, tx);

                    const archivedPath = await archivedWrokbook({
                        filingId: filing.id,
                        politicianId,
                        filename: req.file.originalname,
                        buffer: req.file.buffer
                    });

                    return{
                        filing_id: filing.id,
                        politician_id: politicianId,
                        schedules_parsed: {
                            A: Array.isArray(parsedA) ? parsedA.length : parsedA ?? 0,
                            B: Array.isArray(parsedB) ? parsedB.length : parsedB ?? 0,
                            CDE: Array.isArray(parsedCDE) ? parsedCDE.length : parsedCDE ?? 0
                        },
                        archived_path: archivedPath
                    };
                 });

                 return res.status(200).json(summary);
                } catch (error) {
                    if(isDuplicateError(error)) {
                        return res.status(400).json({error: "Duplicate filing"});
                    }

                    if (error?.statusCode === 400) {
                        return res.status(400).json({error: error.message});
                    }

                    return res.status(500).json({ error: "Failed to ingest Form 700 upload "});
                }
            });
            export default router;
        
                    
    