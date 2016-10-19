{stream, prop, send, activate, deactivate, Kefir} = require('../test-helpers.coffee')


describe 'combineProps', ->

  it 'should return stream', ->
    expect(Kefir.combineProps({})).toBeStream()
    expect(Kefir.combineProps({ stream: stream(), props: prop() })).toBeStream()

  it 'should be ended if empty object provided', ->
    expect(Kefir.combineProps({})).toEmit ['<end:current>']

  it 'should be ended if object of ended observables provided', ->
    a = send(stream(), ['<end>'])
    b = send(prop(), ['<end>'])
    c = send(stream(), ['<end>'])
    expect(Kefir.combineProps({a, b, c})).toEmit ['<end:current>']

  it 'should be ended and has current if array of ended properties provided and each of them has current', ->
    a = send(prop(), [1, '<end>'])
    b = send(prop(), [2, '<end>'])
    c = send(prop(), [3, '<end>'])
    expect(Kefir.combineProps({a, b, c})).toEmit [{current: {a: 1, b: 2, c: 3 }}, '<end:current>']

  it 'should activate sources', ->
    a = stream()
    b = prop()
    c = stream()
    expect(Kefir.combineProps({a, b, c})).toActivate(a, b, c)

  it 'should handle events and current from observables', ->
    a = stream()
    b = send(prop(), [0])
    c = stream()
    expect(Kefir.combineProps({a, b, c})).toEmit [
      { a: 1, b: 0, c: 2 },
      { a: 1, b: 3, c: 2 },
      { a: 1, b: 4, c: 2 },
      { a: 1, b: 4, c: 5 },
      { a: 1, b: 4, c: 6 },
      '<end>'
    ], ->
      send(a, [1])
      send(c, [2])
      send(b, [3])
      send(a, ['<end>'])
      send(b, [4, '<end>'])
      send(c, [5, 6, '<end>'])

  it 'when activating second time and has 2+ properties in sources, should emit current value at most once', ->
    a = send(prop(), [0])
    b = send(prop(), [1])
    cb = Kefir.combineProps({a, b})
    activate(cb)
    deactivate(cb)
    expect(cb).toEmit [{current: {a: 0, b: 1}}]

  it 'errors should flow', ->
    a = stream()
    b = prop()
    c = stream()
    expect(Kefir.combineProps({a, b, c})).errorsToFlow(a)
    a = stream()
    b = prop()
    c = stream()
    expect(Kefir.combineProps({a, b, c})).errorsToFlow(b)
    a = stream()
    b = prop()
    c = stream()
    expect(Kefir.combineProps({a, b, c})).errorsToFlow(c)

  it 'should handle errors correctly', ->
    # a:      ---e---v---v-----
    #            1
    # b:      ----v---e----v---
    #                 2
    # c:      -----v---e--v----
    #                  3
    # result: ---eee-vee-eev--
    #            111  23 32

    a = stream()
    b = stream()
    c = stream()
    expect(Kefir.combineProps({a, b, c})).toEmit [
      {error: -1},
      {error: -1},
      {error: -1},
      {a: 3, b: 1, c: 2},
      {error: -2},
      {error: -3},
      {error: -3},
      {error: -2},
      {a: 4, b: 6, c: 5}
    ], ->
      send(a, [{error: -1}])
      send(b, [1])
      send(c, [2])
      send(a, [3])
      send(b, [{error: -2}])
      send(c, [{error: -3}])
      send(a, [4])
      send(c, [5])
      send(b, [6])

  describe 'sampledBy functionality (3 arity combine)', ->

    it 'should return stream', ->
      expect(Kefir.combineProps({}, {})).toBeStream()
      expect(Kefir.combineProps({stream: stream(), props: prop()}, {pstream: stream(), pprop: prop()})).toBeStream()

    it 'should be ended if empty array provided', ->
      expect(Kefir.combineProps({ stream: stream(), prop: prop() }, {})).toEmit []
      expect(Kefir.combineProps({}, { stream: stream(), prop: prop() })).toEmit ['<end:current>']

    it 'should be ended if array of ended observables provided', ->
      a = send(stream(), ['<end>'])
      b = send(prop(), ['<end>'])
      c = send(stream(), ['<end>'])
      expect(Kefir.combineProps({a, b, c}, { stream: stream(), prop: prop() })).toEmit ['<end:current>']

    it 'should be ended and emmit current (once) if array of ended properties provided and each of them has current', ->
      a = send(prop(), [1, '<end>'])
      b = send(prop(), [2, '<end>'])
      c = send(prop(), [3, '<end>'])
      s1 = Kefir.combineProps({a, b}, {c})
      expect(s1).toEmit [{current: {a:1, b:2, c:3}}, '<end:current>']
      expect(s1).toEmit ['<end:current>']

    it 'should activate sources', ->
      a = stream()
      b = prop()
      c = stream()
      expect(Kefir.combineProps({a, b}, {c})).toActivate(a, b, c)

    it 'should handle events and current from observables', ->
      a = stream()
      b = send(prop(), [0])
      c = stream()
      d = stream()
      expect(Kefir.combineProps({c, d}, {a, b})).toEmit [
        { a: 1, b: 0, c: 2, d: 3 },
        { a: 1, b: 4, c: 5, d: 3 },
        { a: 1, b: 4, c: 6, d: 3 },
        { a: 1, b: 4, c: 6, d: 7 },
        '<end>'
      ], ->
        send(a, [1])
        send(c, [2])
        send(d, [3])
        send(b, [4, '<end>'])
        send(c, [5, 6, '<end>'])
        send(d, [7, '<end>'])

    it 'when activating second time and has 2+ properties in sources, should emit current value at most once', ->
      a = send(prop(), [0])
      b = send(prop(), [1])
      c = send(prop(), [2])
      sb = Kefir.combineProps({a, b}, {c})
      activate(sb)
      deactivate(sb)
      expect(sb).toEmit [{current: {a:0, b:1, c:2}}]

    it 'errors should flow', ->
      a = stream()
      b = prop()
      c = stream()
      d = prop()
      expect(Kefir.combineProps({a, b}, {c, d})).errorsToFlow(a)
      a = stream()
      b = prop()
      c = stream()
      d = prop()
      expect(Kefir.combineProps({a, b}, {c, d})).errorsToFlow(b)

    # https://github.com/rpominov/kefir/issues/98
    it 'should work nice for emitating atomic updates', ->
      a = stream()
      b = a.map (x) -> x + 2
      c = a.map (x) -> x * 2
      expect(Kefir.combineProps({b}, {c})).toEmit [
        {b: 3, c: 2},
        {b: 4, c: 4},
        {b: 5, c: 6}
      ], ->
        send(a, [1, 2, 3])


    it 'it should prefer active keys over passive keys', ->
      a = stream()
      b = stream()
      _a = stream()

      expect(Kefir.combineProps({a, b}, {a: _a})).toEmit [
        {a: 1, b: 4},
        {a: 2, b: 4},
        {a: 3, b: 4}
      ], ->
        send(_a, [-1])
        send(a, [1])
        send(b, [4])
        send(_a, [-2])
        send(a, [2])
        send(_a, [-3])
        send(a, [3])
