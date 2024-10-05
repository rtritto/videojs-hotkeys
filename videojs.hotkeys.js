import videojs from 'video.js'

const hotkeys = function (customOptions = {}) {
  const player = this
  const pEl = player.el()
  const def_options = {
    volumeStep: 0.1,
    seekStep: 5,
    enableMute: true,
    enableVolumeScroll: true,
    enableHoverScroll: false,
    enableFullscreen: true,
    enableNumbers: true,
    enableJogStyle: false,
    alwaysCaptureHotkeys: false,
    captureDocumentHotkeys: false,
    documentHotkeysFocusElementFilter: function () {
      return false
    },
    enableModifiersForNumbers: true,
    enableInactiveFocus: true,
    skipInitialFocus: false,
    playPauseKey: function (e) {
      // Space bar or MediaPlayPause
      return e.which === 32 || e.which === 179
    },
    rewindKey: function (e) {
      // Left Arrow or MediaRewind
      return e.which === 37 || e.which === 177
    },
    forwardKey: function (e) {
      // Right Arrow or MediaForward
      return e.which === 39 || e.which === 176
    },
    volumeUpKey: function (e) {
      // Up Arrow
      return e.which === 38
    },
    volumeDownKey: function (e) {
      // Down Arrow
      return e.which === 40
    },
    muteKey: function (e) {
      // M key
      return e.which === 77
    },
    fullscreenKey: function (e) {
      // F key
      return e.which === 70
    },
    customKeys: {}
  }

  const cPlay = 1
  const cRewind = 2
  const cForward = 3
  const cVolumeUp = 4
  const cVolumeDown = 5
  const cMute = 6
  const cFullscreen = 7

  const options = videojs.obj.merge(def_options, customOptions)

  // Set default player tabindex to handle keydown and doubleclick events
  if (!pEl.hasAttribute('tabIndex')) {
    pEl.setAttribute('tabIndex', '-1')
  }

  // Remove player outline to fix video performance issue
  pEl.style.outline = 'none'

  if ((options.alwaysCaptureHotkeys || !player.autoplay()) && options.skipInitialFocus === false) {
    player.one('play', function () {
      pEl.focus() // Fixes the .vjs-big-play-button handing focus back to body instead of the player
    })
  }

  if (options.enableInactiveFocus) {
    player.on('userinactive', function () {
      // When the control bar fades, re-apply focus to the player if last focus was a control button
      const cancelFocusingPlayer = function () {
        clearTimeout(focusingPlayerTimeout)
      }
      const focusingPlayerTimeout = setTimeout(function () {
        player.off('useractive', cancelFocusingPlayer)
        const activeElement = document.activeElement
        const controlBar = pEl.querySelector('.vjs-control-bar')
        if (activeElement && activeElement.parentElement === controlBar) {
          pEl.focus()
        }
      }, 10)

      player.one('useractive', cancelFocusingPlayer)
    })
  }

  player.on('play', function () {
    // Fix allowing the YouTube plugin to have hotkey support.
    const ifblocker = pEl.querySelector('.iframeblocker')
    if (ifblocker && ifblocker.style.display === '') {
      ifblocker.style.display = 'block'
      ifblocker.style.bottom = '39px'
    }
  })

  const keyDown = function keyDown(event) {
    let wasPlaying
    let seekTime
    const ePreventDefault = event.preventDefault.bind(event)
    const duration = player.duration()
    // When controls are disabled, hotkeys will be disabled as well
    if (player.controls()) {
      // Don't catch keys if any control buttons are focused, unless alwaysCaptureHotkeys is true
      const activeEl = document.activeElement
      if (
        options.alwaysCaptureHotkeys
        || (options.captureDocumentHotkeys && options.documentHotkeysFocusElementFilter(activeEl))
        || activeEl === pEl
        || activeEl === pEl.querySelector('.vjs-tech')
        || activeEl === pEl.querySelector('.vjs-control-bar')
        || activeEl === pEl.querySelector('.iframeblocker')
      ) {
        switch (checkKeys(event, player)) {
          // Spacebar toggles play/pause
          case cPlay: {
            ePreventDefault()
            if (options.alwaysCaptureHotkeys || options.captureDocumentHotkeys) {
              // Prevent control activation with space
              event.stopPropagation()
            }

            if (player.paused()) {
              silencePromise(player.play())
            } else {
              player.pause()
            }
            break
          }
          // Seeking with the left/right arrow keys
          case cRewind: {  // Seek Backward
            wasPlaying = !player.paused()
            ePreventDefault()
            if (wasPlaying) {
              player.pause()
            }
            seekTime = player.currentTime() - seekStepD(event);
            // The flash player tech will allow you to seek into negative
            // numbers and break the seekbar, so try to prevent that.
            if (seekTime <= 0) {
              seekTime = 0;
            }
            player.currentTime(seekTime)
            if (wasPlaying) {
              silencePromise(player.play())
            }
            break
          }
          case cForward: {  // Seek Forward
            wasPlaying = !player.paused()
            ePreventDefault()
            if (wasPlaying) {
              player.pause()
            }
            seekTime = player.currentTime() + seekStepD(event);
            // Fixes the player not sending the end event if you
            // try to seek past the duration on the seekbar.
            if (seekTime >= duration) {
              seekTime = wasPlaying ? duration - 0.001 : duration;
            }
            player.currentTime(seekTime)
            if (wasPlaying) {
              silencePromise(player.play())
            }
            break
          }
          // Volume control with the up/down arrow keys
          case cVolumeDown: {
            ePreventDefault()
            if (options.enableJogStyle) {
              seekTime = player.currentTime() - 1;
              if (player.currentTime() <= 1) {
                seekTime = 0;
              }
              player.currentTime(seekTime)
            } else {
              player.volume(player.volume() - options.volumeStep)
            }
            break
          }
          case cVolumeUp: {
            ePreventDefault()
            if (options.enableJogStyle) {
              seekTime = player.currentTime() + 1;
              if (seekTime >= duration) {
                seekTime = duration;
              }
              player.currentTime(seekTime)
            } else {
              player.volume(player.volume() + options.volumeStep)
            }
            break
          }
          // Toggle Mute with the M key
          case cMute: {
            if (options.enableMute) {
              player.muted(!player.muted())
            }
            break
          }
          // Toggle Fullscreen with the F key
          case cFullscreen: {
            if (options.enableFull && player.isFullscreen()) {
              player.exitFullscreen()
            } else {
              player.requestFullscreen()
            }
            break
          }
          default: {
            // Number keys from 0-9 skip to a percentage of the video. 0 is 0% and 9 is 90%
            if (
              ((event.which > 47 && event.which < 59) || (event.which > 95 && event.which < 106))
              // Do not handle if enableModifiersForNumbers set to false and keys are Ctrl, Cmd or Alt
              && (options.enableModifiersForNumbers || !(event.metaKey || event.ctrlKey || event.altKey))
              && options.enableNumbers
            ) {
              const sub = event.which > 95 ? 96 : 48
              const number = event.which - sub
              ePreventDefault()
              player.currentTime(player.duration() * number * 0.1)
            }

            // Handle any custom hotkeys
            for (const customKey in options.customKeys) {
              const customHotkey = options.customKeys[customKey]
              // Check for well formed custom keys
              if (
                customHotkey && customHotkey.key && customHotkey.handler
                // Check if the custom key's condition matches
                && customHotkey.key(event)
              ) {
                ePreventDefault()
                customHotkey.handler(player, options, event)
              }
            }
          }
        }
      }
    }
  }

  let volumeHover = false
  const volumeSelector = pEl.querySelector('.vjs-volume-menu-button') || pEl.querySelector('.vjs-volume-panel')
  if (volumeSelector !== null) {
    volumeSelector.addEventListener('mouseover', function () {
      volumeHover = true
    })
    volumeSelector.addEventListener('mouseout', function () {
      volumeHover = false
    })
  }

  const mouseScroll = function mouseScroll(event) {
    const activeEl = options.enableHoverScroll
      // If we leave this undefined then it can match non-existent elements below
      ? 0
      : document.activeElement

    // When controls are disabled, hotkeys will be disabled as well
    if (
      player.controls()
      && (options.alwaysCaptureHotkeys
        || activeEl === pEl
        || activeEl === pEl.querySelector('.vjs-tech')
        || activeEl === pEl.querySelector('.iframeblocker')
        || activeEl === pEl.querySelector('.vjs-control-bar')
        || volumeHover)
      && options.enableVolumeScroll
    ) {
      const delta = Math.max(-1, Math.min(1, event.wheelDelta || -event.detail))
      event.preventDefault()

      if (delta === 1) {
        player.volume(player.volume() + options.volumeStep)
      } else if (delta === -1) {
        player.volume(player.volume() - options.volumeStep)
      }
    }
  }

  const checkKeys = function checkKeys(e, player) {
    // Allow some modularity in defining custom hotkeys

    // Play/Pause check
    if (options.playPauseKey(e, player)) {
      return cPlay
    }

    // Seek Backward check
    if (options.rewindKey(e, player)) {
      return cRewind
    }

    // Seek Forward check
    if (options.forwardKey(e, player)) {
      return cForward
    }

    // Volume Up check
    if (options.volumeUpKey(e, player)) {
      return cVolumeUp
    }

    // Volume Down check
    if (options.volumeDownKey(e, player)) {
      return cVolumeDown
    }

    // Mute check
    if (options.muteKey(e, player)) {
      return cMute
    }

    // Fullscreen check
    if (options.fullscreenKey(e, player)) {
      return cFullscreen
    }
  }

  function seekStepD(e) {
    // SeekStep caller, returns an int, or a function returning an int
    return typeof options.seekStep === 'function' ? options.seekStep(e) : options.seekStep
  }

  function silencePromise(value) {
    if (value !== null && typeof value.then === 'function') {
      value.then(null, function (e) { })
    }
  }

  if (options.captureDocumentHotkeys) {
    const capDocHK = function (event) {
      keyDown(event)
    }
    document.addEventListener('keydown', capDocHK)

    this.dispose = function () {
      document.removeEventListener('keydown', capDocHK)
    }
  } else {
    player.on('keydown', keyDown)
  }

  player.on('mousewheel', mouseScroll)
  player.on('DOMMouseScroll', mouseScroll)
}

videojs.registerPlugin('hotkeys', hotkeys)

export default hotkeys