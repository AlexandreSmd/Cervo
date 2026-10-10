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
      "binary,vrai_faux,1,La Terre est ronde.,,vrai,,,,Elle est presque sphérique.",
      "mcq,culture,2,Capitale du Canada ?,Toronto|Ottawa|Montréal|Vancouver,Ottawa,,,,Ottawa est la capitale.",
      "numeric,estimation,2,Hauteur de la Skytree ?,,634,log,3,m,Elle mesure 634 m.",
    ].join("\n");
    const [b, m, n] = csvToQuestions(csv);
    expect(b.correct_answer).toBe(true);
    expect(m.choices).toEqual(["Toronto", "Ottawa", "Montréal", "Vancouver"]);
    expect(n.correct_answer).toBe(634);
    expect(n.numeric_config).toMatchObject({ scale: "log", factor: 3, unit: "m" });
  });

  it("lit jusqu'à deux photos", () => {
    const csv =
      "type,category,difficulty,prompt,correct_answer,explanation,image1_url,image1_alt,image2_url,image2_alt\n" +
      "short_text,culture,2,Qui est-ce ?,Marie Curie,Physicienne.,/a.jpg,Portrait A,/b.jpg,Portrait B";
    expect(csvToQuestions(csv)[0].images).toEqual([
      { url: "/a.jpg", alt: "Portrait A" },
      { url: "/b.jpg", alt: "Portrait B" },
    ]);
  });
});
