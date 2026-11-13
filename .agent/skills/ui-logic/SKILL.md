Role: Lead Designer, Design Ops, Senior Developer, Motion Engineer
Purpose: Define the operational rules, mathematical foundations, motion language, sensory feedback system, and implementation structure for building a spatial, high-performance interface system from scratch.

1. System Overview

Antigravity UI/UX is a spatial design framework built on three core pillars:

Spatial Depth — interfaces exist in layered volume, not flat planes.
Damped Harmonic Motion — movement is physically legible, responsive, and interruptible.
Human Behavioral Psychology — interaction decisions are optimized for cognitive load, reachability, and emotional completion.

The visual language combines the fluidity of Apple iOS, the ergonomic reachability of Samsung One UI, and a volumetric treatment using glassmorphism, layered blur, elevation, and shadow physics.

2. Design Principles
2.1 Core Principles
Proximity implies hierarchy. Nearer objects feel more actionable.
Depth implies state. Higher elevation means stronger prominence and interactivity.
Motion reveals causality. Every animation must explain why the UI changed.
Reachability is a primary constraint. Important actions should be placed within thumb-accessible zones.
Feedback must be immediate. Visual, acoustic, and haptic responses should occur without perceptible delay.
Graceful degradation is mandatory. The system must remain usable when performance or ambient conditions change.
2.2 Design Language Rules
Use soft corners, layered translucency, and restrained shadows.
Avoid hard edges unless enforcing destructive or critical states.
Prefer depth and motion over excessive ornamentation.
Use minimal friction in key flows; use deliberate friction only for irreversible actions.
3. Mathematical Foundation
3.1 Grid System

The system uses an 8pt base grid for macro layout and a 4pt sub-grid for fine alignment.

8pt Grid

Use the 8pt grid for:

spacing between major components,
card separation,
vertical rhythm,
section padding,
responsive layout alignment.
4pt Grid

Use the 4pt grid for:

internal component padding,
icon alignment,
text baseline correction,
border radii refinement,
optical adjustments.
Grid Formula

Let:

g
8
	​

=8n

g
4
	​

=4n


where n∈Z
+
.

All spacing tokens should resolve to values derived from either g
8
	​

 or g
4
	​

. Fractional or arbitrary values are disallowed unless required by optical correction or platform constraints.

3.2 Type Scale — Major Third

The type scale follows a Major Third ratio:

Scale Ratio=1.250



The generalized formula for type steps is:

T
n
	​

=T
0
	​

×1.25
n



Where:

T
n
	​

 = type size at step n

T
0
	​

 = base body size
n = step index (positive or negative)
Example Reference Scale (Base = 16px)
Step	Formula	Size (px)	Usage
-2	16/1.25
2

	10.24	Fine print, metadata
-1	16/1.25
	12.80	Secondary labels
0	16
	16.00	Body text
1	16×1.25
	20.00	Emphasized body / small headings
2	16×1.25
2

	25.00	Section titles
3	16×1.25
3

	31.25	Page headings
4	16×1.25
4

	39.06	Hero headings
5	16×1.25
5

	48.83	Display text
Typographic Rules
Body text must remain within a readable contrast and line-height envelope.
Headings should increase by discrete scale steps; do not interpolate arbitrary sizes.
Line height should generally fall between 1.35–1.55 for body text and 1.05–1.20 for display headings.
Use weight and spacing before resorting to size escalation.
4. Cognitive Engine

The cognitive engine defines how spatial UI responds to human decision-making limits and attention behavior.

4.1 Hick’s Law

The time required to make a choice increases with the number of visible options.

Rule
Present only the minimum viable set of choices at any one time.
Group secondary actions into progressive disclosure.
For high-frequency tasks, keep primary action count at 1–3.
For complex screens, split into stages instead of presenting dense menus.
Application in Spatial UI
Use depth to separate primary from secondary decisions.
Place urgent actions on the top-most or nearest layer.
Collapse tertiary controls into contextual sheets, side panels, or hover/press expansions.
4.2 Fitts’s Law (Reachability)

Target acquisition time depends on the distance to and size of the target.

Rule
Increase target size for high-frequency actions.
Reduce reach distance for important actions.
Place primary controls in thumb-accessible zones on mobile.
Use edge anchoring where possible because screen edges function as natural boundaries.
Spatial UI Application
Primary action buttons should be physically large, visually elevated, and close to the natural resting area of the hand.
Destructive actions should never be accidentally reachable by default.
A small button may only exist if its function is rare and low-risk.
4.3 Peak-End Rule

Users remember experiences mostly by their peak moment and final moment.

Rule
Design one memorable positive peak in key flows.
End each task with clear confirmation, visible closure, and emotional resolution.
Avoid abrupt dead-ends.
Error recovery must end with a calm, explanatory, confidence-restoring state.
Application in Spatial UI
Success states should float upward, brighten, or resolve into a cleaner layout.
Completion feedback should include a brief motion signature and a final resting pose.
The last interaction in a flow should feel more polished than the intermediate steps.
5. Visual Specification
5.1 Glassmorphism Refraction Rules

Glass layers are used to create depth, softness, and translucency.

Base Rules
Every glass surface must contain a subtle 1px inner stroke.
The inner stroke should be low-opacity and follow the surface contour.
Blur should reflect the layer’s depth, not merely its styling preference.
Saturation and tint should remain restrained to preserve readability.
Blur Guidance
Foreground glass: 18–24px backdrop blur
Mid-layer glass: 24–36px backdrop blur
Background glass: 36–48px backdrop blur
Refraction Principles
Higher-opacity foreground layers should use lower blur.
Deeper layers may use stronger blur, but never at the cost of content legibility.
Glass surfaces should preserve a clear visual boundary through a combination of stroke, shadow, and tonal separation.
5.2 Z-Axis Elevation Table

Z-index alone does not define depth; it must be paired with blur and shadow behavior.

Elevation Tier	Z-Index Range	Blur Radius	Shadow Opacity	Shadow Softness	Use Case
Z0 / Surface	0–1	0–4px	0.04	Minimal	Base canvas, background planes
Z1 / Lifted	2–10	6–10px	0.08	Light	Cards, list items, passive panels
Z2 / Floating	11–50	12–18px	0.12	Medium	Tooltips, bottom sheets, popovers
Z3 / Prominent	51–100	18–28px	0.18	Strong	Active dialogs, command surfaces
Z4 / Critical	101+	28–40px	0.24	Very strong	Overlays, modal focus states, destructive confirmations
Elevation Rules
Do not increase shadow opacity without also adjusting blur and offset.
High elevation objects should feel physically closer and more actionable.
Large shadow jumps are only permitted when the UI is intentionally changing state or layer ownership.
5.3 Corner Radius and Edge Behavior
Use radii that reinforce softness without becoming indistinct.
Primary surfaces: moderately rounded.
Floating controls: more pill-like.
Large containers: slightly less rounded than their nested elements to maintain hierarchy.
5.4 Liquid Glass System — True Refraction Surfaces

The Liquid Glass system extends standard glassmorphism into physically-inspired, dynamic refraction surfaces that simulate real optical behavior rather than static blur.

Core Principles
Glass is not a blur layer — it is a light-bending medium.
Surfaces must respond to background luminance, motion, and depth.
Refraction should feel alive, subtle, and spatially accurate.
Optical Model (Simplified)

R(x, y) = B(x + dx, y + dy) * a + L

Where:

R = refracted output
B = background sample
dx, dy = distortion offsets
a = opacity factor
L = light contribution
Structural Layers

Each liquid glass surface must include:

Refraction layer
Blur layer
Inner stroke (1px)
Specular highlight
Shadow layer
Refraction Rules
Distortion: 2–8px depending on elevation
Stronger near edges, weaker at center
Use noise or gradient distortion maps
Preserve text readability
Specular Highlights
Edge or corner-based highlights
Opacity: 0.08–0.18
Blend: overlay or screen
Subtle parallax motion
Motion Behavior
Hover → increase refraction + highlight
Press → compress (reduce blur)
Drag → directional distortion
Performance Rules
Fallback to static blur on low GPU
Disable animated highlights in reduced motion
5.5 Gradient System — Volumetric Energy Gradients

Flat gradients are disallowed. All gradients must simulate energy flow, heat diffusion, or light refraction to reinforce spatial depth.

Core Gradient Principles
Gradients must feel alive, directional, and volumetric.
Avoid linear two-color blends.
Use multi-stop gradients with uneven distribution.
Introduce hotspots, falloff zones, and diffusion edges.
Blend gradients with blur and glow to simulate depth.
Gradient Types
Type	Description	Usage
Thermal Flow	Heat-like gradients (orange/red/yellow) with bright cores	Hero backgrounds, attention areas
Aurora Diffusion	Soft purple/blue/pink diffusion with blur	Glass surfaces, cards
Energy Ring	Circular or wave-like gradients with glow trails	Highlights, focus states
Plasma Field	High contrast glowing bands with motion feel	Interactive surfaces
Gradient Construction Rules
Use 3–6 color stops minimum.
Place brightest color off-center (never perfectly centered).
Apply Gaussian blur or backdrop blur layering to soften transitions.
Combine with radial + linear hybrid gradients.
Introduce subtle noise (1–2%) to prevent banding.
Example Gradient Formula (CSS Concept)
background: radial-gradient(
  circle at 70% 30%,
  #ffb347 0%,
  #ff7a00 20%,
  #ff3d00 45%,
  #8b0000 70%,
  #1a0000 100%
);
filter: blur(20px);
Glass + Gradient Integration
Gradients should sit behind glass layers, not inside them.
Glass surfaces must refract gradient light subtly.
Use gradient brightness to drive perceived elevation.
Motion Integration
Gradients may shift slowly (≤ 8s loop) to simulate energy flow.
Movement must be subtle and non-distracting.
Tie gradient motion to interaction states where applicable.
Performance Rules
On low GPU, replace multi-layer gradients with simplified 2–3 stop versions.
Disable animated gradients in reduced motion mode.
6. Kinetic Physics

Motion in Antigravity UI/UX is modeled as a damped spring system.

6.1 Spring Model

Use the damped harmonic motion approximation:

F=−kx−cv



Where:

F = restoring force
k = stiffness constant
x = displacement
c = damping coefficient
v = velocity

The visual result should remain responsive without overshooting into chaos.

6.2 Motion Profiles
Motion Mode	Stiffness (k)	Damping (c)	Mass (m)	Visual Intent
Floating	180–260	18–26	0.8–1.2	Lively, buoyant, premium
Settling	260–420	28–40	1.0–1.6	Stable, grounded, resolved
Floating Animation Rules
Use for transient layers, cards, and contextual surfaces.
Motion should show slight elasticity.
Small overshoot is acceptable if it communicates energy.
Duration should remain short and responsive.
Settling Animation Rules
Use for final states, confirmations, and anchored UI.
Reduce oscillation quickly.
Prioritize perceived stability over expressiveness.
6.3 Interruptible Motion

All motion must be interruptible.

Rule
Any in-progress animation should accept new user intent immediately.
A new gesture, click, drag, or command supersedes the current motion state.
No animation may block input.
When interrupted, the system must reconcile to the nearest valid state without visual snapping.
Implementation Notes
Preserve current velocity where appropriate.
Blend from the current animated position into the new target state.
Avoid hard resets unless the interaction is destructive or the state machine is invalid.
7. Sensory Integration

The system uses synchronized visual, haptic, and sonic cues to reinforce action outcomes.

7.1 Haptic Feedback Mapping
Action	Haptic Pattern	Intensity	Purpose
Tap / Confirm	Single short pulse	Low	Positive acknowledgment
Toggle On	Double soft pulse	Low–Medium	State change reinforcement
Toggle Off	Single soft tap	Low	State closure
Drag Start	Gentle onset pulse	Low	Object capture confirmation
Drop / Commit	Firm pulse	Medium	Completion and placement
Error	Triple sharp pulse	Medium–High	Attention and correction
Destructive Action	Long pulse with decay	High	Seriousness and caution
Success Completion	Brief rising pulse	Medium	Reward and closure
7.2 Sonic Branding

High-frequency acoustic triggers should be short, discreet, and non-fatiguing.

Sonic Rules
Sounds must be less than 250ms for most interactions.
Use high-frequency transient cues for recognition, not loudness.
Avoid repeated harsh tones.
Sonic cues should support the brand identity without becoming intrusive.
Suggested Action Mapping
Action	Sonic Cue Character	Duration	Emotional Intent
Confirm	Soft glass tick	<150ms	Clarity
Success	Bright rising ping	120–200ms	Completion
Toggle	Subtle click	<120ms	Precision
Drag Drop	Light landing chime	150–220ms	Placement
Error	Muted low crack + chirp	100–180ms	Correction
Critical Alert	Layered alert ping	180–250ms	Urgency
Audio Constraints
Maintain low fatigue under repeated use.
Do not mask speech or accessibility cues.
Support mute and reduced-motion-reduced-sound modes.
8. Adaptive Logic
8.1 Ambient Light Adaptation

The interface should adapt contrast, glass opacity, and glow intensity based on the environment.

Rules
In bright environments, increase surface contrast and reduce transparency slightly.
In dark environments, lower glow intensity and prevent bloom from washing out text.
In mixed lighting, preserve neutral mid-tones and prioritize readability.
Text contrast must remain legible at all times.
Adaptive Behavior
Bright light: stronger stroke visibility, slightly denser surface tint.
Low light: deeper shadows, softer highlights, reduced glare.
Auto mode: sample ambient conditions and transition gradually, not abruptly.
8.2 GPU Performance Throttling

The design system must gracefully degrade when rendering budgets are constrained.

Degradation Priority
Preserve layout integrity.
Preserve text readability.
Preserve essential motion semantics.
Reduce decorative blur and layered effects.
Simplify shadows and refraction.
Reduce non-essential transitions last.
Throttling Rules
On low-end devices, reduce blur radius first.
Lower shadow complexity before removing depth hierarchy.
Switch from spring-heavy motion to simpler ease curves only when necessary.
Never remove critical feedback states.
Graceful Degradation States
Performance State	Visual Strategy	Motion Strategy	Effect Budget
Full	Full glass + shadow + spring motion	Physics-based	Maximum
Reduced	Lower blur and fewer layered highlights	Simplified spring	Moderate
Minimal	Flat surfaces with depth hints	Basic easing	Low
Emergency	Static interface, no decorative motion	Instant transitions	Minimum
9. Technical Handoff
9.1 Design Token Export Structure

All rules should be exportable into JSON design tokens.

Recommended Token Domains
color
surface
border
radius
spacing
typography
shadow
blur
elevation
motion
haptics
audio
accessibility
adaptive
Example JSON Token Schema
{
  "antigravity": {
    "spacing": {
      "grid8": {
        "value": 8,
        "type": "dimension"
      },
      "grid4": {
        "value": 4,
        "type": "dimension"
      }
    },
    "typography": {
      "scaleRatio": {
        "value": 1.25,
        "type": "number"
      },
      "baseSize": {
        "value": 16,
        "type": "dimension"
      }
    },
    "motion": {
      "floating": {
        "stiffness": 220,
        "damping": 22,
        "mass": 1.0
      },
      "settling": {
        "stiffness": 340,
        "damping": 34,
        "mass": 1.3
      }
    },
    "surface": {
      "glass": {
        "innerStrokeWidth": 1,
        "foregroundBlur": 20,
        "midBlur": 30,
        "backgroundBlur": 40
      }
    }
  }
}
9.2 Rive State-Machine Logic

The animation system should map design states to a Rive state machine or equivalent runtime.

State Definitions
Idle
Hover
Pressed
Focused
Dragging
Floating
Settling
Success
Error
Disabled
ReducedMotion
LowPerformance
State Transition Rules
Hover may transition to Pressed, Focused, or Idle.
Dragging may transition to Floating, Settling, or Idle.
Success and Error should always resolve to a resting state.
LowPerformance and ReducedMotion should override decorative animation while preserving state clarity.
Suggested Event Mapping
Event	Trigger	Resulting State
pointerEnter	Cursor enters target	Hover
pointerDown	Press or touch start	Pressed
pointerUp	Release	Settling / Success
dragStart	Object capture	Dragging
dragEnd	Object release	Settling
validationFail	Constraint not met	Error
validationPass	Constraint met	Success
perfDrop	GPU budget reduced	LowPerformance
reducedMotionOn	Accessibility preference enabled	ReducedMotion
9.3 Developer Handoff Requirements

The developer implementation must ensure:

tokens are source-controlled,
motion constants are centralized,
states are testable in isolation,
accessibility preferences override decorative rules,
every interactive surface has defined feedback behavior,
reduced-performance paths are verified before release.
10. Accessibility and Compliance
10.1 Required Accessibility Rules
Contrast must remain sufficient under all adaptive themes.
Motion must respect reduced-motion preferences.
Haptics and sound must be optional.
Focus states must be visible and spatially clear.
All interactive elements must be keyboard accessible.
10.2 Behavioral Safety Rules
Never rely on motion alone to communicate state.
Never use depth or blur to hide essential actions.
Avoid sensory overload in dense workflows.
Preserve usability in low-vision, low-power, and noisy environments.