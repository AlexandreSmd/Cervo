import { describe, expect, it } from "vitest";
import { csvToQuestions, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("gère les guillemets et les virgules dans les cellules", () => {
    expect(parseCsv('a,b\n"x, y","il dit ""oui"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'il dit "oui"'],
    ]);
  });
  it("détecte le point-virgule (Excel français)", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("csvToQuestions", () => {
  it("convertit chaque type de question", () => {
    const csv = [
      "type,category,difficulty,prompt,choices,correct_answer,scale,factor,unit,explanation",
      "binary,fait,1,La Terre est ronde.,,vrai,,,,Elle est presque sphérique.",
      "mcq,vocabulaire,2,Synonyme de rapide ?,Lent|Véloce|Lourd|Calme,Véloce,,,,Véloce vient du latin velox.",
      "numeric,estimation,2,Hauteur de la Skytree ?,,634,log,3,m,Elle mesure 634 m.",
    ].join("\n");
    const [b, m, n] = csvToQuestions(csv);
    expect(b.correct_answer).toBe(true);
    expect(m.choices).toEqual(["Lent", "Véloce", "Lourd", "Calme"]);
    expect(n.correct_answer).toBe(634);
    expect(n.numeric_config).toMatchObject({ scale: "log", factor: 3, unit: "m" });
  });

  it("lit jusqu'à deux photos", () => {
    const csv =
      "type,category,difficulty,prompt,correct_answer,explanation,image1_url,image1_alt,image2_url,image2_alt\n" +
      "short_text,enigme,2,Qui est-ce ?,Marie Curie,Physicienne.,/a.jpg,Portrait A,/b.jpg,Portrait B";
    expect(csvToQuestions(csv)[0].images).toEqual([
      { url: "/a.jpg", alt: "Portrait A" },
      { url: "/b.jpg", alt: "Portrait B" },
    ]);
  });

  it("lit les devinettes, chronologies, rappels et pourcentages", () => {
    const csv = [
      "type,category,difficulty,prompt,correct_answer,clues,order_details,memorize_items,recall_ordered,explanation",
      "riddle,devinette,1,Quel animal suis-je ?,koala,Je dors.|Je mange de l'eucalyptus.|Je vis en Australie.,,,,Le koala dort.",
      "order,chronologie,2,Classe.,Rome|Oxford|Aztèques,,753 av. J.-C.|1096|1325,,,Dates.",
      "recall,memoire,2,Retape.,4|8|1|5,,,4|8|1|5,oui,Mémoire.",
      "percent,stat,1,Part des océans ?,71,,,,,71 %.",
    ].join("\n");
    const [riddle, order, recall, percent] = csvToQuestions(csv);
    expect(riddle.clues).toHaveLength(3);
    expect(order.correct_answer).toEqual(["Rome", "Oxford", "Aztèques"]);
    expect(order.order_details).toEqual(["753 av. J.-C.", "1096", "1325"]);
    expect(recall).toMatchObject({ correct_answer: ["4", "8", "1", "5"], recall_ordered: true, memorize: { items: ["4", "8", "1", "5"] } });
    expect(percent.correct_answer).toBe(71);
  });
});
