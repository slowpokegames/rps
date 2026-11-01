(ns rps.print-deck
  (:require [rps.engine :as e]
            [rps.games  :as g]
            [clojure.string :as str]))

(def ^:private suit-color
  {:rock "#BABABA" :paper "#EAD410" :scissors "#E81020"
   :lizard "#00A878" :spock "#8028BE"})

(def ^:private glyph-filter
  {:rock     "grayscale(1)"
   :paper    nil
   :scissors "hue-rotate(-50deg) saturate(2.2)"
   :lizard   "hue-rotate(100deg) brightness(0.78)"
   :spock    "hue-rotate(226deg) saturate(1) brightness(0.8)"})

(def ^:private css "
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #EDEBE7; font-family: system-ui, sans-serif; padding: 20px; }
.page-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.page-title { font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.page-sub { font-size: 11px; color: #A09488; }
.legend { display: flex; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #A09488;
               font-family: 'SF Mono','Fira Mono',monospace; }
.legend-swatch { width: 12px; height: 12px; border-radius: 2px; }
.deck-scroll { overflow-x: auto; }
.page-group { display: grid; grid-template-columns: repeat(5, 176px); gap: 6px;
              width: max-content; margin-bottom: 28px; }
.page-group:last-child { margin-bottom: 0; }
.card { width: 176px; height: 256px; background: #FAFAF8; border: 1px solid #D8D4CE;
        border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0; }
.color-strip { display: block; width: 100%; height: 10px; flex-shrink: 0; }
.card-inner { flex: 1; position: relative; display: flex; flex-direction: column;
              align-items: center; justify-content: center; }
.corner { position: absolute; font-family: 'SF Mono','Fira Mono','Courier New',monospace;
          font-size: 24px; font-weight: 700; letter-spacing: 1px; color: #A09488; line-height: 1; }
.tl { top: 10px; left: 10px; }
.br { bottom: 10px; right: 10px; transform: rotate(180deg); }
.glyphs { display: flex; flex-direction: column; align-items: center; gap: 4px; line-height: 1.1; }
.g1 { font-size: 54px; } .g2 { font-size: 45px; } .g3 { font-size: 33px; }
.beats { margin-top: 8px; font-family: 'SF Mono','Fira Mono','Courier New',monospace;
         font-size: 12px; color: #A09488; opacity: .65; }
@media print {
  @page { size: letter landscape; margin: 0.3in; }
  body { background: white; padding: 0; }
  .page-header, .legend { display: none; }
  .deck-scroll { overflow: visible; }
  .page-group { grid-template-columns: repeat(5, 1fr); gap: 4pt; width: auto;
                margin-bottom: 0; break-after: page; }
  .page-group:last-child { break-after: auto; }
  .card { width: auto; height: 184pt; border: .5pt solid #c0bbb5;
          border-radius: 4pt; break-inside: avoid; }
  .color-strip { height: 8pt; }
  .suit-strip { height: 8pt; }
  .corner { font-size: 19pt; letter-spacing: .5pt; }
  .g1 { font-size: 42pt; } .g2 { font-size: 35pt; } .g3 { font-size: 26pt; }
  .beats { font-size: 9pt; margin-top: 5pt; }
}")

(defn- glyph-span [game sym class]
  (let [f (get glyph-filter sym)
        style (when f (str " style=\"filter:" f "\""))]
    (str "<span class=\"" class "\"" style ">"
         (get (:glyphs game) sym)
         "</span>")))

(defn- card-html [game card strength]
  (let [[sym1 sym2 sym3] card
        ascii (e/render-ascii game card)
        [c1 c2 c3] (map #(get suit-color % "#ccc") card)
        svg-strip (str "<svg class=\"color-strip\" viewBox=\"0 0 900 10\""
                       " preserveAspectRatio=\"none\" xmlns=\"http://www.w3.org/2000/svg\">"
                       "<polygon points=\"0,0 415,0 400,10 0,10\" fill=\"" c1 "\"/>"
                       "<polygon points=\"415,0 730,0 700,10 400,10\" fill=\"" c2 "\"/>"
                       "<polygon points=\"730,0 900,0 900,10 700,10\" fill=\"" c3 "\"/>"
                       "</svg>")]
    (str "<div class=\"card\">"
         svg-strip
         "<div class=\"card-inner\">"
         "<span class=\"corner tl\">" ascii "</span>"
         "<div class=\"glyphs\">"
         (glyph-span game sym1 "g1")
         (glyph-span game sym2 "g2")
         (glyph-span game sym3 "g3")
         "</div>"
         "<span class=\"beats\">" strength "</span>"
         "<span class=\"corner br\">" ascii "</span>"
         "</div></div>")))

(defn- legend-html [game]
  (str "<div class=\"legend\">"
       (str/join ""
         (map (fn [sym]
                (str "<div class=\"legend-item\">"
                     "<div class=\"legend-swatch\" style=\"background:"
                     (get suit-color sym "#888") "\"></div>"
                     (let [f (get glyph-filter sym)]
                       (if f
                         (str "<span style=\"filter:" f "\">" (get (:glyphs game) sym) "</span>")
                         (str "<span>" (get (:glyphs game) sym) "</span>")))
                     "&nbsp;"
                     (str/capitalize (name sym))
                     "</div>"))
              (:symbols game)))
       "</div>"))

(defn- generate [game]
  (let [deck    (e/make-deck game)
        n       (count deck)
        sym-idx (zipmap (:symbols game) (range))
        sorted  (->> deck
                     (map (fn [card] [card (e/strength game card deck)]))
                     (sort-by (fn [[card s]] [(sym-idx (first card)) (- s)])))]
    (str "<!DOCTYPE html>\n<html lang=\"en\">\n"
         "<head><meta charset=\"UTF-8\">"
         "<title>" (:name game) " Deck</title>"
         "<style>" css "</style></head>\n"
         "<body>\n"
         "<div class=\"page-header\">"
         "<span class=\"page-title\">" (:name game) " Deck</span>"
         "<span class=\"page-sub\">" n " cards · all 3-symbol permutations</span>"
         "</div>\n"
         (legend-html game)
         "<div class=\"deck-scroll\">\n"
         (str/join "\n"
           (map (fn [chunk]
                  (str "<div class=\"page-group\">\n"
                       (str/join "\n" (map (fn [[card s]] (card-html game card s)) chunk))
                       "\n</div>"))
                (partition-all 15 sorted)))
         "\n</div>\n</body>\n</html>\n")))

(defn -main [& _]
  (let [path "deck.html"]
    (spit path (generate g/rps5))
    (println "Written:" path)))
