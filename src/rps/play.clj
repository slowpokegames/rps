(ns rps.play
  (:require [rps.engine :as e]
            [rps.games  :as g]))

(def ^:private hand-size 7)

(defn- new-state [game n]
  (let [deck  (shuffle (e/make-deck game))
        hands (mapv vec (partition hand-size (take (* hand-size n) deck)))
        pile  (subvec deck (* hand-size n))]
    {:game       game
     :hands      hands
     :deck       (subvec pile 1)
     :discard    [(first pile)]
     :current    0
     :next-draws 0
     :next-skip  false}))

(defn- active-card [{:keys [discard]}] (peek discard))

(defn- advance [{:keys [current hands] :as state}]
  (assoc state :current (mod (inc current) (count hands))))

(defn- reshuffle [{:keys [discard] :as state}]
  (assoc state :deck (vec (shuffle (pop discard))) :discard [(peek discard)]))

(defn- draw-for [state player]
  (let [state (if (empty? (:deck state)) (reshuffle state) state)]
    (if (empty? (:deck state))
      state
      (-> state
          (update-in [:hands player] conj (first (:deck state)))
          (update :deck subvec 1)))))

(defn- pw-note [pw]
  (cond (= pw 2) " → skip next player"
        (= pw 3) " → next player draws 2"
        :else ""))

(defn- show-hand [game hand plays ac]
  (doseq [[i card] (map-indexed vector hand)]
    (let [can? (plays card)
          pw   (when can? (e/positions-won game card ac))]
      (println (str "  [" (inc i) "] "
                    (e/render game card) " " (e/render-ascii game card)
                    (if can? (str "  ✓" (pw-note pw)) ""))))))

(defn- read-choice [n-cards]
  (loop []
    (print (str "Play [1-" n-cards "] or [d]raw: "))
    (flush)
    (let [s (.trim ^String (read-line))]
      (cond
        (= s "d") :draw
        (re-matches #"\d+" s)
        (let [n (Integer/parseInt s)]
          (if (and (>= n 1) (<= n n-cards))
            (dec n)
            (do (println "Number out of range.") (recur))))
        :else (do (println "Enter a number or 'd'.") (recur))))))

(defn- interactive-turn [{:keys [game hands current] :as state}]
  (let [hand  (nth hands current)
        ac    (active-card state)
        plays (set (filter #(e/can-play? game % ac) hand))]
    (println (str "\n=== Player " (inc current) " ==="))
    (println (str "Active: " (e/render game ac) " " (e/render-ascii game ac)))
    (show-hand game hand plays ac)
    (if (empty? plays)
      (do (println "No legal plays — drawing 1.")
          (-> (draw-for state current) advance))
      (let [choice (read-choice (count hand))]
        (if (= choice :draw)
          (do (println "Drawing 1.")
              (-> (draw-for state current) advance))
          (let [card (nth hand choice)]
            (if-not (plays card)
              (do (println "That card can't be played.") (interactive-turn state))
              (let [pw    (e/positions-won game card ac)
                    state (-> state
                              (update-in [:hands current] (fn [h] (vec (remove #{card} h))))
                              (update :discard conj card)
                              (cond-> (= pw 2) (assoc :next-skip true))
                              (cond-> (= pw 3) (assoc :next-draws 2)))]
                (println (str "Played: " (e/render game card) " " (e/render-ascii game card) (pw-note pw)))
                (when (= 1 (count (get-in state [:hands current])))
                  (println (str "  *** Player " (inc current) " says RPS! ***")))
                (advance state)))))))))

(defn- take-turn [{:keys [current next-draws next-skip] :as state}]
  (let [state (assoc state :next-draws 0 :next-skip false)]
    (cond
      next-skip
      (do (println (str "\n  Player " (inc current) " is skipped!"))
          (advance state))
      (pos? next-draws)
      (do (println (str "\n  Player " (inc current) " draws " next-draws "!"))
          (-> (reduce (fn [s _] (draw-for s current)) state (range next-draws))
              advance))
      :else
      (interactive-turn state))))

(defn- winner [{:keys [hands]}]
  (first (keep-indexed #(when (empty? %2) %1) hands)))

(defn play-game
  ([game] (play-game game 2))
  ([game n-players]
   (println (str "\n=== " (:name game) " — " n-players " players ==="))
   (println (str "Deck: " (count (e/make-deck game)) " cards, hand size: " hand-size))
   (loop [state (new-state game n-players)]
     (if-let [w (winner state)]
       (println (str "\n*** Player " (inc w) " wins! ***"))
       (recur (take-turn state))))))

(defn -main [& args]
  (let [n (if (seq args) (Integer/parseInt (first args)) 2)]
    (play-game g/rps5 n)))
