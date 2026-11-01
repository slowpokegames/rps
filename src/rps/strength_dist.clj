(ns rps.strength-dist
  (:require [rps.engine :as e]
            [rps.games  :as g]))

(defn strength-distribution [game]
  (let [deck (e/make-deck game)]
    (->> deck
         (map #(e/strength game % deck))
         frequencies
         (sort-by key))))

(defn -main [& _]
  (doseq [game [g/rps5 g/rps7-rotational g/rps7-paley g/rps7-mixed]]
    (println (:name game))
    (doseq [[beats n] (strength-distribution game)]
      (println (format "  beats %3d -> %3d cards" beats n)))
    (println)))
