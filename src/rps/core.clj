(ns rps.core
  (:require [rps.engine :as e]
            [rps.games  :as g])
  (:gen-class))

(defn -main [& _]
  (doseq [game [g/rps5 g/rps7-rotational g/rps7-paley g/rps7-mixed]]
    (let [deck (e/make-deck game)]
      (println (str (:name game) " — " (count deck) " cards"))
      (println "  out-nbr types:" (e/nbr-type-summary game))
      (println "  sample hand:")
      (doseq [c (e/deal game 4)]
        (println "   " (e/render game c) (e/render-ascii game c)))
      (println))))
