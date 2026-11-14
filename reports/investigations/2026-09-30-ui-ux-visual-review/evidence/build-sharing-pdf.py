"""Build a portable PDF; original screenshots and concepts are never modified."""
from pathlib import Path
import os, io, json, html
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle
from PIL import Image as Raster
REPORT_ID="BM-UX-20260930-944b4dd-r1"
FOLDER=Path(__file__).resolve().parent.parent
ROOT=FOLDER.parents[2]
OUT=Path(os.environ.get("REVIEW_SHARE_OUTPUT",str(ROOT/"dist/ui-ux-visual-review-share")))
OUT.mkdir(parents=True,exist_ok=True)
font_dir=Path(os.environ.get("REVIEW_FONT_DIR","/System/Library/Fonts/Supplemental"))
for name,file in [("Review","Arial.ttf"),("ReviewBold","Arial Bold.ttf"),("ReviewItalic","Arial Italic.ttf")]:
 pdfmetrics.registerFont(TTFont(name,str(font_dir/file)))
pdfmetrics.registerFontFamily("Review",normal="Review",bold="ReviewBold",italic="ReviewItalic",boldItalic="ReviewBold")
data=json.loads((FOLDER/"evidence/review-data.json").read_text())
W,H=landscape(A3);M=42;CW=W-2*M
styles=getSampleStyleSheet()
for name,size,leading in [("Body",12,17),("Small",10,14),("Compact",9,11),("Cover",32,38),("Area",22,28),("Sub",17,22)]:
 styles.add(ParagraphStyle(name,fontName="ReviewBold" if name in ("Cover","Area","Sub") else "Review",fontSize=size,leading=leading,textColor=colors.HexColor("#242830"),spaceAfter=10))
styles["Small"].textColor=colors.HexColor("#565e6a")
story=[];image_cache={}
def para(value,style="Body"):return Paragraph(html.escape(value).replace("\n","<br/>"),styles[style])
def text(value,style="Body"):story.append(para(value,style))
def label(name,value):story.append(Paragraph("<b>"+html.escape(name)+".</b> "+html.escape(value),styles["Body"]))
def title(value,key=None,level=0):
 p=para(value,"Area")
 if key:p.bookmark_key=key;p.bookmark_level=level;p.bookmark_title=value
 story.append(p)
def graphic(relative,max_height):
 if relative not in image_cache:
  b=io.BytesIO()
  with Raster.open(FOLDER/relative) as image:
   width,height=image.size
   image.convert("RGB").save(b,format="JPEG",quality=94,subsampling=0,optimize=True)
  image_cache[relative]=(b.getvalue(),width,height)
 encoded,width,height=image_cache[relative];scale=min(CW/width,max_height/height)
 flow=Image(io.BytesIO(encoded),width=width*scale,height=height*scale);flow.hAlign="CENTER"
 story.extend([flow,Spacer(1,9)])
def table(rows,widths,padding=6):
 flow=Table(rows,colWidths=widths,hAlign="LEFT",repeatRows=1)
 flow.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),padding),("BOTTOMPADDING",(0,0),(-1,-1),padding),("LINEBELOW",(0,0),(-1,-1),.5,colors.HexColor("#d5d9df")),("BACKGROUND",(0,0),(-1,0),colors.HexColor("#f3f4f5"))]))
 story.extend([flow,Spacer(1,16)])
text("Binary Markdown\nUI/UX visual design review","Cover")
text("Independent reviewer edition · 1 October 2026","Sub")
text("12 review areas · 20 current screenshots · 36 final generated concepts")
label("Review ID",REPORT_ID);label("Snapshot",data["date"]+" · "+data["sourceCommit"])
label("Status","Static proposals. No application visual changes are implemented or approved.")
text("For each area, compare Current with Recommended, Moderate and Experimental, in that order. Recommended is the consultant’s proposed balance of usability, visual quality, consistency and implementation practicality; it is not owner acceptance.")
text("All visuals and rationales are embedded. Read offline without a repository or companion files. Use the document outline to jump between areas and options, and zoom to inspect small labels. Optional source links need internet access.")
label("Current-product boundary","GitHub main advanced after capture, including code-block toolbar and wrapping changes. This package preserves the original snapshot. Recheck current behavior before implementing a choice, especially area 06.")
title("Questions for the design discussion")
for value in ["Does writing remain primary while actions stay discoverable?","Which labels or states remove ambiguity and support recovery?","Does a new mode or panel justify its interaction and implementation cost?","Which Markdown, keyboard, selection, undo and theme behaviors must survive?","What requires a prototype or user study before approval?"]:text("• "+value)
text("Return an area ID, preference, reasoning and unresolved questions through the worksheet, PDF annotations or a GitHub PR comment. The owner makes the implementation decision.","Small")
story.append(PageBreak());title("Review map","review-map")
rows=[[para("Area","Compact"),para("Priority and evidence","Compact"),para("Options","Compact")]]
for item in data["items"]:
 rows.append([Paragraph('<link href="#'+item["id"]+'"><b>'+html.escape(item["id"])+'</b> · '+html.escape(item["title"])+'</link>',styles["Compact"]),para(item["priority"]+"\n"+item["kind"],"Compact"),para("1 Recommended\n2 Moderate\n3 Experimental","Compact")])
table(rows,[CW*.40,CW*.36,CW*.24],padding=4)
text("Suggested implementation sequence: code readability, palette recovery, Find labels, explicit Source mode, then equation/diagram recovery. Layout, toolbar, outline and tables can follow as a coordinated pass. Export is a separate host-integrated task.")
text("High means frequent-task clarity, measured readability or recovery; Medium means useful refinement. Design priority is not a claim that every row is a functional defect.")
story.append(PageBreak());title("Shared design language","design-language")
rows=[[para("Element","Small"),para("Proposed language","Small"),para("Purpose","Small")]]
for row in [("Light surfaces","#FAFAF8 canvas; #F3F4F5 rail; thin dividers","Keep the article primary"),("Text","#242830 charcoal; system sans; monospace for source","Quiet hierarchy and source recognition"),("Accent","#4266B0 blue; pair color with text or shape","Consistent selection, focus and action"),("Dark surfaces","#1B1E26 canvas; #272D38 secondary surface; pale tokens","Carry hierarchy into dark themes"),("Spacing and shape","8 px rhythm; about 6 px radii; 1 px borders","Consistency without decorative card layers"),("Interaction","Purpose labels, grouped commands, explicit modes, progressive disclosure","Reduce scanning and recovery effort")]:
 rows.append([para(x,"Small") for x in row])
table(rows,[CW*.19,CW*.48,CW*.33])
text("The provisional audience is students and developers writing prose, code, equations and tables. These are design targets, not measured properties of generated pixels. Preserve supported themes and user preferences.")
title("Evidence and limits")
text("Current visuals use unchanged shared production markup, CSS and scripts in a browser with synthetic Markdown and a test HostBridge: English messages, macOS utility labels, Full toolbar, open outline, Automatic table controls and width guidance. Most captures use Things; code uses Night. These are not installed-VSIX screenshots.")
text("Export availability, failure and warnings were simulated in the real UI. They show layout, not converter results, output files or reader fidelity. All document text, author values and paths are synthetic.")
text("Generated concepts do not validate keyboard access, performance, selection mapping, undo, saving or export. Written legends define scope when incidental generated text, shortcut glyphs, counters, durations or chrome differs. No sharing, comments, AI, code execution or cell merging is proposed.")
text("No complete assistive-technology audit, exhaustive theme/locale result, native-settings/image-dialog redesign, TeX/Mermaid certification or output-reader acceptance is claimed.","Small")
story.append(PageBreak());title("Measured code contrast","contrast")
text("Computed Night-theme colors in the captured JavaScript sample. Ratios use standard sRGB relative luminance; they do not certify all themes or generated images.")
rows=[[para(x,"Small") for x in ["Token","Foreground","Actual background","Ratio","4.5:1 target"]]]
for row in [("String","#032F62","#24283B","1.10:1","Below"),("Number","#005CC5","#24283B","2.31:1","Below"),("Keyword","#D73A49","#24283B","3.18:1","Below"),("Comment","#6A737D","#24283B","3.03:1","Below")]:rows.append([para(x,"Small") for x in row])
table(rows,[CW*.2]*5)
text("The existing quoted-code test inspects the plain foreground and checks distinct syntax colors. It does not measure every syntax token; that test was inspected, not executed for this report.")
for name,url in [("W3C contrast minimum","https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"),("VS Code webview UX guidance","https://code.visualstudio.com/api/ux-guidelines/webviews")]:story.append(Paragraph('<link href="'+url+'">'+name+'</link>',styles["Small"]))
text("Implementation must measure actual tokens and backgrounds, preserve themes, provide stable accessible names and exercise keyboard interaction. Approving an image does not satisfy those criteria.")
story.append(PageBreak())
for item in data["items"]:
 title(item["id"]+" · "+item["title"],item["id"]);text(item["kind"]+" · "+item["priority"],"Small")
 label("Observed current state",item["observation"])
 name=item["current"][0];graphic("images/current/"+name,415);text(data["captures"][name],"Small")
 label("Preserve",item["preserve"])
 for file,line,caption in item["source"]:
  url="https://github.com/BinaryOutlook/binary-markdown/blob/"+data["sourceCommit"]+"/"+file+"#L"+str(line)
  story.append(Paragraph('<link href="'+url+'">'+html.escape(caption)+'</link> · '+html.escape(file)+':'+str(line),styles["Small"]))
 story.append(PageBreak())
 for name in item["current"][1:]:
  title(item["id"]+" · Supporting current visual");text(data["captures"][name],"Sub");graphic("images/current/"+name,620)
  text("Same unchanged-source and synthetic-input boundaries as the main capture. This is a baseline observation, not a generated redesign.","Small");story.append(PageBreak())
 for number,option in enumerate(item["options"],1):
  title(item["id"]+" · "+str(number)+". "+option["level"],option["id"],1);text(item["title"]+" · Static generated concept","Small");graphic(option["image"],455)
  for index,annotation in enumerate(option["annotations"],1):text(str(index)+". "+annotation)
  label("Design rationale",option["rationale"]);label("Practicality and tradeoff",option["tradeoff"]);story.append(PageBreak())
 title(item["id"]+" · Future acceptance");text("These are later implementation criteria; a static image has not satisfied them.")
 for criterion in item["acceptance"]:text("• "+criterion)
 label("Preservation boundary",item["preserve"])
 text("Which option balances the benefits and costs, what should change, and what evidence would change your judgment?");story.append(PageBreak())
title("Review worksheet","worksheet")
rows=[[para("Area","Compact"),para("Preference","Compact"),para("Reason, concern or required change","Compact")]]
for item in data["items"]:rows.append([para(item["id"]+" · "+item["title"],"Compact"),para("Recommended / Moderate /\nExperimental / Revise / Defer","Compact"),para("_________________________________\n_________________________________","Compact")])
table(rows,[CW*.35,CW*.26,CW*.39],padding=4);text("Overall priorities and philosophy questions:","Sub")
for _ in range(3):text("________________________________________________________________________________________________________________________")
text("The owner can mix levels, request changes or defer an area. A selected option first becomes a focused implementation plan and validation scope.","Compact")
story.append(PageBreak());title("Provenance and validation","provenance")
label("Source",data["sourceCommit"]);label("Review branch","feat/ui-ux-visual-review")
text("The repository report records exact prompts, source hashes, capture interactions, dimensions and image hashes. Eight replaced illustrations are retained for provenance, not as recommendations.")
text("The PDF uses original pixels at native resolution, JPEG-encoded at quality 94 for file size. Original PNG/JPEG files are unchanged. The HTML edition embeds original image bytes, the complete written report/evidence, and optional local feedback export.")
text("The unchanged source compiled with Node 24.21.0 after npm ci. Documentation, raw/rendered Markdown, image inventory and source-preservation checks were performed. No installed VSIX, real converter, exported reader or assistive-technology acceptance is implied.")
text("To reproduce a source preview, use the recorded revision, exact .node-version, npm, Python 3 and a browser; follow the repository build guide and retained build-preview.cjs. Synthetic fixtures and injected export states are recorded with the report.")
for command in ["npm ci --no-audit --no-fund","npm run compile","node reports/investigations/2026-09-30-ui-ux-visual-review/evidence/build-preview.cjs","python3 -m http.server 8767 --bind 127.0.0.1 --directory .vscode-test/ui-ux-visual-review/web"]:text(command,"Small")
text("Screenshots depend on fonts, viewport, focus and zoom. Generation is nondeterministic; retained hashes identify the specific concepts. Public project provenance and source references remain intact.")
text("Publication audit covers report contents, image metadata, sharing scripts and Git scope; it is not an application-wide penetration test. Feedback tools keep notes in the local browser tab and export plain text. Nothing is automatically uploaded.")
text("No application implementation, default change, product release or merge is authorized by this document.")
class ReviewDocument(SimpleDocTemplate):
 def afterFlowable(self,flow):
  if hasattr(flow,"bookmark_key"):
   self.canv.bookmarkPage(flow.bookmark_key);self.canv.addOutlineEntry(flow.bookmark_title,flow.bookmark_key,flow.bookmark_level,False)
def footer(canvas,document):
 canvas.saveState();canvas.setStrokeColor(colors.HexColor("#d5d9df"));canvas.line(M,30,W-M,30)
 canvas.setFont("Review",9);canvas.setFillColor(colors.HexColor("#565e6a"))
 canvas.drawString(M,18,REPORT_ID+" · Proposals only · Snapshot 30 Sep 2026");canvas.drawRightString(W-M,18,str(document.page));canvas.restoreState()
output=OUT/"Binary-Markdown-UI-UX-Review-2026-09-30.pdf"
ReviewDocument(str(output),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=36,bottomMargin=42,title="Binary Markdown UI/UX visual design review",author="Binary Markdown design review",subject="Static visual proposals for independent review").build(story,onFirstPage=footer,onLaterPages=footer)
print(json.dumps({"file":output.name,"bytes":output.stat().st_size,"sourceImages":len(image_cache)}))
