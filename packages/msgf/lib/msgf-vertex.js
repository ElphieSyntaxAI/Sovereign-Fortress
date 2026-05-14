"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_ACCOUNT_PATH = exports.DEFAULT_GEMINI_MODEL = void 0;
exports.assertServiceAccountPresent = assertServiceAccountPresent;
exports.getGcpProjectId = getGcpProjectId;
exports.getVertexGenerativeModel = getVertexGenerativeModel;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vertexai_1 = require("@google-cloud/vertexai");
exports.DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
exports.SERVICE_ACCOUNT_PATH = path_1.default.join(process.cwd(), 'service-account.json');
function assertServiceAccountPresent() {
    if (!fs_1.default.existsSync(exports.SERVICE_ACCOUNT_PATH)) {
        throw new Error(`MSGF: service-account.json not found at ${exports.SERVICE_ACCOUNT_PATH}. Run \`node msgf-init.js\` or add the file before starting.`);
    }
}
function getGcpProjectId() {
    if (process.env.GCP_PROJECT_ID)
        return process.env.GCP_PROJECT_ID;
    const raw = fs_1.default.readFileSync(exports.SERVICE_ACCOUNT_PATH, 'utf8');
    const { project_id } = JSON.parse(raw);
    if (!project_id) {
        throw new Error('MSGF: service-account.json must include project_id.');
    }
    return project_id;
}
let vertexAI = null;
let generativeModel = null;
function getVertexGenerativeModel() {
    assertServiceAccountPresent();
    if (!vertexAI) {
        const location = process.env.GCP_LOCATION || 'us-central1';
        vertexAI = new vertexai_1.VertexAI({
            project: getGcpProjectId(),
            location,
            googleAuthOptions: {
                keyFile: exports.SERVICE_ACCOUNT_PATH,
            },
        });
        generativeModel = vertexAI.getGenerativeModel({
            model: process.env.MSGF_VERTEX_MODEL || exports.DEFAULT_GEMINI_MODEL,
        });
    }
    return generativeModel;
}
