from fpdf import FPDF
import json
from pathlib import Path

OUTPUT  = Path(__file__).parent / "calcutta-player-guide.pdf"
players = json.loads(Path("calcutta-players.json").read_text())

FORM_LABEL = {"Improving": "Improving (+)", "Declining": "Declining (-)", "Stable": "Stable", "No data": "No data"}


def fmt_net(n):
    """Net score to par: E even, + over, - under. '-' when no data."""
    if n is None:
        return "-"
    if n == 0:
        return "E"
    return f"+{n}" if n > 0 else str(n)

FLIGHT_META = {
    "A": {"title": "Flight A  -  Best Players", "r": 26,  "g": 74,  "b": 58,  "lr": 232, "lg": 245, "lb": 238},
    "B": {"title": "Flight B  -  Mid Tier",     "r": 26,  "g": 46,  "b": 74,  "lr": 232, "lg": 237, "lb": 245},
    "C": {"title": "Flight C  -  Higher Handicaps", "r": 74, "g": 26, "b": 26, "lr": 245, "lg": 232, "lb": 232},
}

class PDF(FPDF):
    def header(self):
        self.set_fill_color(26, 46, 74)
        self.rect(0, 0, 216, 28, "F")
        self.set_y(5)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(201, 168, 76)
        self.cell(0, 8, "Youche Country Club  -  Calcutta Player Guide", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(200, 210, 220)
        self.cell(0, 5, "2026 Season  |  Flights by Percentile  |  Net-to-Par from 2 Years of GHIN Scores", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 5,
                  "L10 / 2yr / Best / LY '25 = NET score to par on White tees (E even, + over, - under). "
                  "L10 = last 10 rounds, 2yr = 2-year avg, Best = ceiling, LY '25 = this same event on 2025-06-21 ('-' = did not play). "
                  "HI / Low = current & 365-day-low Index. Crs = course handicap (70.4/127/71). * SHARP = at season low.",
                  align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, f"Page {self.page_no()}", align="C")

    def flight_block(self, flight):
        meta = FLIGHT_META[flight]
        fp   = sorted([p for p in players if p["event_flight"] == flight],
                      key=lambda p: p["posted_hcp"])

        # Section header bar
        self.set_fill_color(meta["r"], meta["g"], meta["b"])
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 10, f"  {meta['title']}   ({len(fp)} players)",
                  fill=True, new_x="LMARGIN", new_y="NEXT")

        # Column headers
        self.set_fill_color(240, 240, 240)
        self.set_text_color(80, 80, 80)
        self.set_font("Helvetica", "B", 9)
        self.set_line_width(0.2)
        self.set_draw_color(200, 200, 200)
        col_w = [44, 14, 14, 16, 15, 15, 14, 16, 32]
        labels = ["Player", "HI", "Low", "Crs", "L10", "2yr", "Best", "LY '25", "Form"]
        # L10 / 2yr / Best / LY '25 are NET to par (white tees)
        for lbl, w in zip(labels, col_w):
            self.cell(w, 7, lbl, border="B", fill=True, align="C" if lbl != "Player" else "L")
        self.ln()

        # Data rows
        self.set_font("Helvetica", "", 10)
        for i, p in enumerate(fp):
            # alternating row bg
            if i % 2 == 0:
                self.set_fill_color(meta["lr"], meta["lg"], meta["lb"])
            else:
                self.set_fill_color(255, 255, 255)
            fill = True

            # Name (with SHARP marker)
            self.set_text_color(20, 20, 20)
            self.set_font("Helvetica", "B", 10)
            name = f"  {p['signup_name']}" + ("  *" if p.get("sharp") else "")
            self.cell(col_w[0], 9, name, border="B", fill=fill, align="L")

            # Handicap Index — colored
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(meta["r"], meta["g"], meta["b"])
            self.cell(col_w[1], 9, str(p["posted_hcp"]), border="B", fill=fill, align="C")

            # 365-day low index
            self.set_font("Helvetica", "", 10)
            self.set_text_color(80, 80, 80)
            self.cell(col_w[2], 9, str(p.get("low_hi", "")), border="B", fill=fill, align="C")

            # Course handicap — flagged red if over the 24 event max
            over = p.get("over_max", False)
            if over:
                self.set_fill_color(220, 60, 60)
                self.set_text_color(255, 255, 255)
            else:
                self.set_text_color(40, 40, 40)
            self.set_font("Helvetica", "B", 10)
            label = f"{p.get('course_handicap', '')}{'!' if over else ''}"
            self.cell(col_w[3], 9, label, border="B", fill=True, align="C")
            # restore row fill for subsequent cells
            if i % 2 == 0:
                self.set_fill_color(meta["lr"], meta["lg"], meta["lb"])
            else:
                self.set_fill_color(255, 255, 255)

            # Net-to-par: L10 (current form), 2yr baseline, best (ceiling)
            self.set_font("Helvetica", "", 10)
            self.set_text_color(80, 80, 80)
            self.cell(col_w[4], 9, fmt_net(p.get("net_l10")), border="B", fill=fill, align="C")
            self.cell(col_w[5], 9, fmt_net(p.get("net_2yr")), border="B", fill=fill, align="C")
            self.set_text_color(120, 90, 30)
            self.cell(col_w[6], 9, fmt_net(p.get("net_best")), border="B", fill=fill, align="C")

            # Last year's same event (2025-06-21) net-to-par
            self.set_font("Helvetica", "B", 9.5)
            self.set_text_color(26, 46, 74)
            self.cell(col_w[7], 9, fmt_net(p.get("net_ly")), border="B", fill=fill, align="C")

            # Form (from 2yr recent-vs-prior trend)
            form = p.get("form", "Stable")
            if form == "Improving":
                self.set_text_color(20, 120, 60)
            elif form == "Declining":
                self.set_text_color(160, 30, 30)
            else:
                self.set_text_color(80, 80, 80)
            self.set_font("Helvetica", "B", 8.5)
            self.cell(col_w[8], 9, FORM_LABEL.get(form, form), border="B", fill=fill, align="C")
            self.ln()

        self.set_text_color(20, 20, 20)
        self.ln(2)

        over_max = [p for p in fp if p.get("over_max")]
        if over_max:
            self.set_font("Helvetica", "B", 9.5)
            self.set_text_color(200, 40, 40)
            names = ", ".join(f"{p['signup_name']} ({p['course_handicap']})" for p in over_max)
            self.multi_cell(0, 5, f"  ! OVER 24 MAX COURSE HANDICAP: {names}")
            self.set_text_color(20, 20, 20)

        self.ln(5)

    def legend(self):
        self.set_font("Helvetica", "I", 8.5)
        self.set_text_color(100, 100, 100)
        self.set_x(10)
        self.cell(0, 5,
                  "Form (last 10 rounds vs prior 20, over 2 years):  Improving (+) / Stable / Declining (-)."
                  "    * SHARP = index at/near its 365-day low (peaking).",
                  align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_draw_color(200, 168, 76)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)


pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=18)

for flight in ("A", "B", "C"):
    pdf.add_page()
    pdf.legend()
    pdf.flight_block(flight)

pdf.output(str(OUTPUT))
print(f"Saved: {OUTPUT}")
