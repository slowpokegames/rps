(ns rps.archetypes
  (:require [rps.engine :as e]
            [rps.games  :as g]))

(defn rel [game a b] (if (e/beats? game a b) ">" "<"))

(defn pattern-str [game [a b c]]
  (str "prim" (rel game a b) "sec  "
       "prim" (rel game a c) "ter  "
       "sec"  (rel game b c) "ter"))

(defn print-archetypes [game primary-sym]
  (let [deck       (e/make-deck game)
        first-sym  (filter #(= primary-sym (first %)) deck)
        by-strength (sort-by key (group-by #(e/strength game % deck) first-sym))]
    (println (str "\n=== " (:name game) " archetypes (primary = " (name primary-sym) ") ==="))
    (doseq [[s cards] by-strength]
      (println (str "\n  beats " s ":"))
      (doseq [card cards]
        (println "   " (e/render game card) (e/render-ascii game card)
                 " " (pattern-str game card))))))

(defn -main [& _]
  (print-archetypes g/rps5 :rock)
  (print-archetypes g/rps7-rotational :a)
  (print-archetypes g/rps7-paley :a))
