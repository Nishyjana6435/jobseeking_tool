// Turns the extracted profile into flat, ATS-shaped fields for copy-paste into application forms.
const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };

export function parseDate(s = "") {
  const t = String(s).trim();
  if (!t) return { month: "", year: "", raw: "" };
  if (/present|current|now/i.test(t)) return { month: "", year: "", raw: "Present", current: true };
  const m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m) return { month: MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()] || "", year: m[2], raw: t };
  const y = t.match(/(\d{4})/);
  return { month: "", year: y ? y[1] : "", raw: t };
}

export function splitName(full = "") {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") || "" };
}

export function buildFillSheet(profile, cfg = {}) {
  const name = splitName(profile.name);
  const linkOf = (label) => profile.links.find((l) => new RegExp(label, "i").test(l.label) || new RegExp(label, "i").test(l.url))?.url || "";
  const withProto = (u) => (u && !/^https?:/i.test(u) ? `https://${u}` : u);

  const personal = [
    ["First name", name.first], ["Last name", name.last], ["Full name", profile.name],
    ["Email", profile.email], ["Phone", profile.phone],
    ["City", profile.location.split(",")[0].trim()], ["Country", cfg.country || profile.location.split(",").pop().trim()],
    ["Current location", profile.location],
    ["LinkedIn", withProto(linkOf("linkedin"))], ["GitHub", withProto(linkOf("github"))], ["Portfolio / website", withProto(linkOf("portfolio|space|site|web"))],
    ["Headline / current title", profile.headline],
    ["Years of experience", String(profile.yearsExperience)],
    ["Professional summary", profile.summary],
  ];

  const work = profile.experience.map((e) => {
    const s = parseDate(e.start), en = parseDate(e.end);
    return {
      fields: [
        ["Job title", e.title.split(/—|→/)[0].trim()], ["Full title (as on CV)", e.title], ["Employer", e.company],
        ["Location", /freelance/i.test(e.company) ? "Remote" : profile.location],
        ["Start month", s.month], ["Start year", s.year], ["End month", en.month], ["End year", en.current ? "" : en.year],
        ["Currently work here", en.current ? "Yes" : "No"],
        ["Employment type", /freelance/i.test(e.company) ? "Freelance / Contract" : "Full-time"],
        ["Skills / technologies", e.technologies.join(", ")],
        ["Description", e.highlights.map((h) => `• ${h}`).join("\n")],
      ],
      missing: [!s.year && "start date", !en.year && !en.current && "end date"].filter(Boolean),
    };
  });

  const education = profile.education.map((ed) => {
    const yrs = ed.year.match(/\d{4}/g) || [];
    return {
      fields: [
        ["School / university", ed.institution], ["Degree", ed.degree.split(/\s+(?=[A-Z][a-z]+ )/)[0] || ed.degree],
        ["Degree (full)", ed.degree], ["Field of study", ed.degree.replace(/^(BEng|BSc|MSc|BA|MA|PhD|B\.Eng|B\.Sc|M\.Sc)\.?\s*(\(Hons\))?\s*(in\s+)?/i, "").trim()],
        ["Start year", yrs[0] || ""], ["End / graduation year", yrs[yrs.length - 1] || ""], ["Country", /UK|United Kingdom/i.test(ed.institution) ? "United Kingdom" : ""],
      ],
    };
  });

  const skills = Object.entries(profile.skills).map(([k, v]) => [k, v.join(", ")]);
  return { personal, work, education, skills, certifications: profile.certifications, keywordsCsv: profile.allKeywords.join(", ") };
}
