/** Shared fictional review data. These IDs are deliberately not Tasks Project IDs. */
export type ReviewSurface = "home" | "projects";
export type DirectionId = "a" | "b" | "c";
export type ReviewState = "busy" | "empty" | "partial" | "loading" | "error";
export type ReviewProject = Readonly<{
  id: string; name: string; purpose: string; lead: string; initials: string;
  completed: number | null; total: number | null; late: number | null;
  standing: "Needs attention" | "On track" | "Waiting" | "Not assessed";
  next: string; nextDate: string | null; nextDateLabel: string;
}>;
export type ReviewTask = Readonly<{
  id: string; projectId: string; title: string; context: string; owner: string;
  timing: "Late" | "Today" | "This week" | "Waiting"; due: string; dueDate: string | null;
}>;
export type ReviewFixture = Readonly<{
  actor: string; today: string; dateLabel: string; state: ReviewState;
  projects: readonly ReviewProject[]; tasks: readonly ReviewTask[];
}>;
export type DirectionProps = Readonly<{
  surface: ReviewSurface; data: ReviewFixture;
  onOpenTask: (id: string) => void; onOpenProject: (id: string) => void;
  onNavigate: (surface: ReviewSurface) => void;
}>;

const projects: readonly ReviewProject[] = [
  { id:"review-orchard",name:"The Orchard, events",purpose:"A considered welcome, from the first arrival to the final table.",lead:"Aoife Brennan",initials:"AB",completed:23,total:34,late:2,standing:"Needs attention",next:"Autumn tasting",nextDate:"2026-10-22",nextDateLabel:"Thu 22 Oct" },
  { id:"review-winter",name:"Winter programme",purpose:"Bring the new season into focus.",lead:"Seán Kavanagh",initials:"SK",completed:12,total:20,late:0,standing:"On track",next:"Programme ready",nextDate:"2026-10-26",nextDateLabel:"Mon 26 Oct" },
  { id:"review-courtyard",name:"West courtyard",purpose:"Make a quiet space for the conversations between events.",lead:"Orla Byrne",initials:"OB",completed:8,total:16,late:0,standing:"Waiting",next:"Supplier decision",nextDate:"2026-10-29",nextDateLabel:"Thu 29 Oct" },
  { id:"review-newyear",name:"New-year gathering",purpose:"A small beginning for a good year.",lead:"Tom Reilly",initials:"TR",completed:null,total:null,late:null,standing:"Not assessed",next:"First planning session",nextDate:null,nextDateLabel:"No date yet" },
];
const tasks: readonly ReviewTask[] = [
  {id:"review-seating",projectId:"review-orchard",title:"Approve the final seating plan",context:"Aoife has checked the last guest changes. Your decision keeps the print on schedule.",owner:"You",timing:"Late",due:"Due Fri 16 Oct",dueDate:"2026-10-16"},
  {id:"review-menu",projectId:"review-orchard",title:"Confirm the tasting menu",context:"Review the two vegetarian options before Thursday's tasting.",owner:"You",timing:"Today",due:"Today",dueDate:"2026-10-18"},
  {id:"review-copy",projectId:"review-winter",title:"Review the winter programme",context:"Seán's revised programme is ready for your review.",owner:"You",timing:"Today",due:"Today",dueDate:"2026-10-18"},
  {id:"review-quote",projectId:"review-courtyard",title:"Check the revised supplier quote",context:"The revised quote keeps the delivery date. Check the finish and installation allowance.",owner:"You",timing:"Waiting",due:"Waiting since Tue 13 Oct",dueDate:null},
  {id:"review-brief",projectId:"review-orchard",title:"Share the tasting brief",context:"Give the team one useful reference for the autumn tasting.",owner:"Aoife Brennan",timing:"This week",due:"Wed 21 Oct",dueDate:"2026-10-21"},
  {id:"review-photo",projectId:"review-winter",title:"Choose the programme photographs",context:"Shortlist six images from the existing collection.",owner:"Seán Kavanagh",timing:"This week",due:"Fri 23 Oct",dueDate:"2026-10-23"},
];
export function reviewFixture(state: ReviewState): ReviewFixture {
  const partial = state === "partial";
  return {actor:"Orla",today:"2026-10-18",dateLabel:"Sunday 18 October",state,
    projects: state === "empty" ? [] : partial ? projects.map((p,index)=> index===1 ? {...p,completed:null,total:null,late:null,standing:"Not assessed" as const} : p) : projects,
    tasks: state === "empty" ? [] : tasks};
}
export const directionNames: Record<DirectionId,string> = {a:"The Brief",b:"The Workbench",c:"The Horizon"};
export const directionArguments: Record<DirectionId,{thesis:string;tradeoff:string}> = {
 a:{thesis:"A clear daily brief, with one useful next decision and room to think.",tradeoff:"Less simultaneous detail; prioritises focus over a portfolio dashboard."},
 b:{thesis:"Keep your work and its context together. Move between projects without losing your place.",tradeoff:"More information in view; rewards frequent use more than first-glance simplicity."},
 c:{thesis:"Understand today through what comes next. See meaningful dates across your projects.",tradeoff:"Strongest for date-led work; undated work needs a deliberate place of its own."},
};
