(ns rps.engine)

;; ── Deck generation ──────────────────────────────────────────────────────────

(defn- perms [coll k]
  (if (zero? k)
    [[]]
    (for [x coll p (perms (remove #{x} coll) (dec k))]
      (into [x] p))))

(defn make-deck [{:keys [symbols hand-size]}]
  (vec (perms symbols hand-size)))

;; ── Dominance ─────────────────────────────────────────────────────────────────

(defn beats? [{:keys [beats]} a b] (contains? beats [a b]))

(defn compare-cards [game c1 c2]
  (loop [[s1 & r1] c1 [s2 & r2] c2]
    (cond
      (nil? s1)           :draw
      (= s1 s2)           (recur r1 r2)
      (beats? game s1 s2) :win
      :else               :lose)))

(defn dominates?   [game c1 c2]     (= :win (compare-cards game c1 c2)))
(defn beaten-by    [game card xs]   (filter #(dominates? game card %) xs))
(defn beaters-of   [game card xs]   (filter #(dominates? game % card) xs))
(defn strength     [game card xs]   (count (beaten-by game card xs)))
(defn undominated  [game xs]        (remove #(seq (beaters-of game % xs)) xs))
(defn dominated    [game xs]        (filter #(seq (beaters-of game % xs)) xs))

(defn rank-by-strength [game xs]
  (sort-by #(- (strength game % xs)) xs))

(defn best-counter [game hand pool]
  (apply max-key #(count (filter (partial dominates? game %) hand)) pool))

(defn deal [game n] (take n (shuffle (make-deck game))))

;; ── Rendering ────────────────────────────────────────────────────────────────

(defn render       [{:keys [glyphs]}  card] (apply str (map glyphs  card)))
(defn render-ascii [{:keys [letters]} card] (apply str (map letters card)))

(defn print-hand [game cards]
  (doseq [c cards]
    (println (render game c) (render-ascii game c))))

;; ── Card play (Uno-style) ─────────────────────────────────────────────────────

(defn can-play?
  "True if card can be played on active: every position must match or beat."
  [game card active]
  (every? (fn [[s1 s2]] (or (= s1 s2) (beats? game s1 s2)))
          (map vector card active)))

(defn positions-won
  "Count of positions where card's symbol strictly beats active's symbol."
  [game card active]
  (count (filter (fn [[s1 s2]] (beats? game s1 s2))
                 (map vector card active))))

;; ── Tournament analysis ───────────────────────────────────────────────────────

(defn out-nbrs [game sym]
  (filter #(beats? game sym %) (:symbols game)))

(defn out-nbr-type
  "Returns :transitive or :cyclic for the tournament on sym's out-neighbourhood."
  [game sym]
  (let [nbrs (out-nbrs game sym)
        out-degs (map (fn [n] (count (filter #(beats? game n %) nbrs))) nbrs)]
    (if (= (sort out-degs) [0 1 2]) :transitive :cyclic)))

(defn nbr-type-summary
  "Map of :transitive/:cyclic -> count, across all vertices."
  [game]
  (frequencies (map #(out-nbr-type game %) (:symbols game))))
