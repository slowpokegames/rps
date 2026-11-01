(ns rps.count-tournaments
  (:require [rps.games :as games]))

(defn- all-perms [xs]
  (if (empty? xs)
    [[]]
    (for [x xs p (all-perms (remove #{x} xs))]
      (cons x p))))

(defn canonical [n beats-set]
  (->> (for [perm (all-perms (range n))]
         (let [m (zipmap (range n) perm)]
           (vec (sort (map (fn [[i j]] [(m i) (m j)]) beats-set)))))
       (reduce (fn [a b] (if (neg? (compare a b)) a b)))))

(defn- build* [pairs beats out-deg k acc]
  (if (empty? pairs)
    (conj acc beats)
    (let [[i j] (first pairs)
          rest   (next pairs)]
      (cond-> []
        (< (out-deg i) k) (into (build* rest (conj beats [i j]) (update out-deg i inc) k acc))
        (< (out-deg j) k) (into (build* rest (conj beats [j i]) (update out-deg j inc) k acc))))))

(defn build-regular-tournaments [n]
  (build* (for [i (range n) j (range n) :when (< i j)] [i j])
          #{} (vec (repeat n 0)) (/ (dec n) 2) []))

(defn out-nbrs [beats-set v]
  (keep (fn [[i j]] (when (= i v) j)) beats-set))

(defn out-nbr-type [beats-set v]
  (let [nbrs      (set (out-nbrs beats-set v))
        internal  (filter (fn [[i j]] (and (nbrs i) (nbrs j))) beats-set)
        win-count (frequencies (map first internal))
        out-degs  (sort (map #(get win-count % 0) nbrs))]
    (if (= out-degs [0 1 2]) :transitive :cyclic)))

(defn classify [n beats-set]
  (frequencies (map #(out-nbr-type beats-set %) (range n))))

(defn game->int-beats [{:keys [symbols beats]}]
  (let [idx (zipmap symbols (range))]
    (set (map (fn [[a b]] [(idx a) (idx b)]) beats))))

(defn -main [& _]
  (let [n  7
        ts (build-regular-tournaments n)
        by-canon (group-by #(canonical n %) ts)
        reps     (map first (vals by-canon))
        sorted   (sort-by #(get (classify n %) :transitive 0) reps)]
    (println "Labeled regular tournaments on" n "vertices:" (count ts))
    (println "Non-isomorphic classes:" (count reps))
    (println)
    (doseq [[idx rep] (map-indexed vector sorted)]
      (println (str "Class " (inc idx) ":"))
      (println "  out-nbr type dist:" (classify n rep)))
    ;; Print a representative beats set for each class
    (println "Representatives:")
    (doseq [[idx rep] (map-indexed vector sorted)]
      (println (str "  Class " (inc idx) ": " (vec (sort rep)))))
    (println)
    ;; Identify which class each named game belongs to
    (doseq [[name game] [["rps7-rotational" games/rps7-rotational]
                         ["rps7-paley"      games/rps7-paley]]]
      (let [ibits (game->int-beats game)
            cf    (canonical n ibits)
            class (->> (map-indexed vector sorted)
                       (filter (fn [[_ rep]] (= (canonical n rep) cf)))
                       ffirst
                       inc)]
        (println name "→ Class" class)))))
