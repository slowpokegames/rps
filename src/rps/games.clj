(ns rps.games)

;; ── RPS-5 ─────────────────────────────────────────────────────────────────────

(def rps5
  {:name      "RPS-5"
   :symbols   [:rock :paper :scissors :lizard :spock]
   :hand-size 3
   :beats     #{[:rock :scissors]  [:rock :lizard]
                [:paper :rock]     [:paper :spock]
                [:scissors :paper] [:scissors :lizard]
                [:lizard :paper]   [:lizard :spock]
                [:spock :scissors] [:spock :rock]}
   :glyphs    {:rock "✊" :paper "🖐" :scissors "✌" :lizard "🤌" :spock "🖖"}
   :letters   {:rock \R :paper \P :scissors \S :lizard \L :spock \I}})

;; ── RPS-7 ─────────────────────────────────────────────────────────────────────
;;
;; A 7-symbol regular tournament has each symbol beating exactly 3 others.
;; There are multiple non-isomorphic such tournaments; we define two canonical ones.
;;
;; Symbols are labelled abstractly :a–:g (indices 0–6). Both games share the
;; same symbol set and rendering; only the beats relation differs.

(def ^:private s7 [:a :b :c :d :e :f :g])
(def ^:private g7 (zipmap s7 ["Ⓐ" "Ⓑ" "Ⓒ" "Ⓓ" "Ⓔ" "Ⓕ" "Ⓖ"]))
(def ^:private l7 (zipmap s7 [\A \B \C \D \E \F \G]))

(defn- rotational-beats [syms offsets]
  (set (for [i (range (count syms)) d offsets]
         [(syms i) (syms (mod (+ i d) (count syms)))])))

;; Rotational R_7: i beats i+1, i+2, i+3 (mod 7).
;; Each vertex's out-neighbourhood forms a transitive (total-order) tournament.
(def rps7-rotational
  {:name      "RPS-7 rotational"
   :symbols   s7
   :hand-size 3
   :beats     (rotational-beats s7 [1 2 3])
   :glyphs    g7
   :letters   l7})

;; Paley P_7: i beats i+1, i+2, i+4 (mod 7)  — offsets are quadratic residues mod 7.
;; Each vertex's out-neighbourhood forms a 3-cycle.
(def rps7-paley
  {:name      "RPS-7 Paley"
   :symbols   s7
   :hand-size 3
   :beats     (rotational-beats s7 [1 2 4])
   :glyphs    g7
   :letters   l7})

;; Mixed tournament: 3 vertices with transitive out-nbrs, 4 with cyclic.
;; The third (and final) non-isomorphic regular tournament on 7 vertices.
;; Beats set is the canonical representative of that class (from enumeration).
(def rps7-mixed
  {:name      "RPS-7 mixed"
   :symbols   s7
   :hand-size 3
   :beats     #{[:a :b] [:a :c] [:a :d]
                [:b :c] [:b :d] [:b :e]
                [:c :d] [:c :f] [:c :g]
                [:d :e] [:d :f] [:d :g]
                [:e :a] [:e :c] [:e :f]
                [:f :a] [:f :b] [:f :g]
                [:g :a] [:g :b] [:g :e]}
   :glyphs    g7
   :letters   l7})
