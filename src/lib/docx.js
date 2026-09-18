import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ExternalHyperlink } from "docx";

const FONT = "Calibri";
const t = (text, opts = {}) => new TextRun({ text, font: FONT, size: 21, ...opts });

function heading(text) {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    children: [t(text.toUpperCase(), { bold: true, size: 22, color: "1F3A5F" })],
  });
}
const bullet = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [t(text)] });

export async function buildDocx(cv) {
  const links = cv.contact.links.map((l) => new ExternalHyperlink({ link: /^https?:/.test(l.url) ? l.url : `https://${l.url}`, children: [t(l.label, { style: "Hyperlink", color: "1F3A5F", underline: {} })] }));
  const contactLine = [cv.contact.location, cv.contact.phone, cv.contact.email].filter(Boolean).join("  |  ");
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t(cv.name, { bold: true, size: 34 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(cv.headline, { size: 22, color: "444444" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t(contactLine, { size: 19 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: links.flatMap((l, i) => (i ? [t("  |  ", { size: 19 }), l] : [l])) }),
    heading("Professional Summary"),
    new Paragraph({ children: [t(cv.summary)] }),
    heading("Core Skills"),
    ...cv.coreSkills.map((g) => new Paragraph({ spacing: { after: 40 }, children: [t(`${g.group}: `, { bold: true }), t(g.items.join(", "))] })),
    heading("Professional Experience"),
    ...cv.experience.flatMap((e) => [
      new Paragraph({ spacing: { before: 120 }, children: [t(e.title, { bold: true }), t(`  |  ${e.company}`)] }),
      new Paragraph({ spacing: { after: 40 }, children: [t(`${e.start} – ${e.end}${e.location ? `  |  ${e.location}` : ""}`, { italics: true, color: "555555", size: 19 })] }),
      ...e.bullets.map(bullet),
    ]),
  ];
  if (cv.projects.length) {
    children.push(heading("Selected Projects"));
    for (const p of cv.projects) {
      children.push(new Paragraph({ spacing: { before: 100 }, children: [t(p.name, { bold: true }), t(`  —  ${p.summary}`)] }));
      children.push(...p.bullets.map(bullet));
      if (p.technologies.length) children.push(new Paragraph({ spacing: { after: 40 }, children: [t(`Technologies: ${p.technologies.join(", ")}`, { italics: true, size: 19, color: "555555" })] }));
    }
  }
  children.push(heading("Education"));
  children.push(...cv.education.map((e) => new Paragraph({ children: [t(e.degree, { bold: true }), t(`  |  ${e.institution}  |  ${e.year}`)] })));
  if (cv.certifications.length) {
    children.push(heading("Certifications"));
    children.push(...cv.certifications.map(bullet));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
