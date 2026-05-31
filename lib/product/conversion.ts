import { BookOpenText, BrainCircuit, FlaskConical, History, Network, PenLine, Route, Users } from "lucide-react";

export const conversionScenarios = [
  {
    id: "writer",
    title: "写作者找反方",
    body: "把主角选择、世界观设定或核心观点交给两席攻防，快速暴露薄弱处。",
    cta: "用故事设定开辩",
    topic: "主角为了拯救多数人，是否可以牺牲少数无辜者？",
    sideA: "可以，在极端情境下结果责任高于个人洁癖",
    sideB: "不可以，牺牲无辜会摧毁行动的正当性",
    icon: PenLine,
  },
  {
    id: "strategy",
    title: "产品/策略预演",
    body: "让支持方与反对方提前拆解方案，裁判给出风险、证据与反驳评分。",
    cta: "用方案开辩",
    topic: "AI 产品是否应该默认开启自动执行任务能力？",
    sideA: "应该，自动执行能显著降低用户完成复杂任务的摩擦",
    sideB: "不应该，默认自动化会放大误操作、成本与信任风险",
    icon: BrainCircuit,
  },
  {
    id: "study",
    title: "学生/研究者练论证",
    body: "围绕论文、课堂辩题或研究假设做多轮攻防，沉淀可复盘卷宗。",
    cta: "用研究题开辩",
    topic: "城市治理是否应允许算法裁量参与行政判断？",
    sideA: "应允许，但必须限定边界并接受人工复核",
    sideB: "不应允许，行政判断不能被不可解释模型替代",
    icon: FlaskConical,
  },
];

export const roadmapModules = [
  {
    id: "persona",
    title: "历史镜像人格",
    status: "等待名单",
    summary: "让孔子、韩非、尼采等人格进入同一议题，适合写作与思想实验。",
    unlock: "累计 50 条有效意向后优先开放预设人格库。",
    icon: History,
  },
  {
    id: "research",
    title: "联网事实检索",
    status: "等待名单",
    summary: "开辩前生成资料包，裁判对无来源断言扣分，适合研究型辩论。",
    unlock: "Pro 用户优先试用来源卡与事实校验。",
    icon: Network,
  },
  {
    id: "companion",
    title: "时空伴游推演",
    status: "路线图",
    summary: "区分史实、推断与虚构分支，用时间线展示选择后的世界线变化。",
    unlock: "Studio 场景验证通过后开放长线推演。",
    icon: Route,
  },
];

export const trustChecklist = [
  "真实模型密钥只走服务端代理",
  "本地 mock 模式三分钟可跑完整流程",
  "结案卷宗可复盘、可导出、可继续追问",
  "上线前补齐认证、隐私条款、删除导出与监控",
];

export const paidUseCases = [
  {
    title: "真实模型接入",
    body: "把 mock 演示升级为 OpenAI 或兼容网关，适合严肃选题。",
    icon: BookOpenText,
  },
  {
    title: "多场复盘沉淀",
    body: "围绕一个项目连续开辩，保存每次裁判结论与薄弱环节。",
    icon: Users,
  },
  {
    title: "导出给团队",
    body: "把结案卷宗整理成 Markdown 或 JSON，用于会议、文档和研究记录。",
    icon: Route,
  },
];
