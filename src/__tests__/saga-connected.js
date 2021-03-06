/* global test, expect, beforeEach */
import { kea } from '../logic/kea'
import { clearActionCache } from '../logic/actions'
import { keaReducer, keaSaga, clearStore } from '../scene/store'

import { PropTypes } from 'prop-types'
import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSagaMiddleware from 'redux-saga'
import { put, take } from 'redux-saga/effects'

beforeEach(() => {
  clearActionCache()
  clearStore()
})

test('runs connected sagas', () => {
  let sagaRan = false
  let connectedSagaRan = false
  let ranLast

  const reducers = combineReducers({
    scenes: keaReducer('scenes')
  })

  const connectedSagaLogic = kea({
    path: () => ['scenes', 'saga', 'connected'],
    start: function * () {
      expect(this.path).toEqual(['scenes', 'saga', 'connected'])
      connectedSagaRan = true
      ranLast = 'connected'
    }
  })

  const sagaLogic = kea({
    path: () => ['scenes', 'saga', 'base'],
    sagas: [connectedSagaLogic.saga],
    start: function * () {
      expect(this.path).toEqual(['scenes', 'saga', 'base'])
      sagaRan = true
      ranLast = 'base'
    }
  })

  expect(sagaLogic._isKeaSingleton).toBe(true)
  expect(sagaLogic._hasKeaConnect).toBe(false)
  expect(sagaLogic._hasKeaLogic).toBe(true)
  expect(sagaLogic._hasKeaSaga).toBe(true)

  expect(sagaLogic.saga).toBeDefined()

  expect(sagaRan).toBe(false)

  const sagaMiddleware = createSagaMiddleware()
  const finalCreateStore = compose(
    applyMiddleware(sagaMiddleware)
  )(createStore)

  finalCreateStore(reducers)

  sagaMiddleware.run(keaSaga)
  sagaMiddleware.run(sagaLogic.saga)

  expect(sagaRan).toBe(true)
  expect(connectedSagaRan).toBe(true)
  expect(ranLast).toBe('base')

  // try a different way of conencting

  let otherConnectedRan = false
  sagaRan = false
  connectedSagaRan = false

  const sagaLogic2 = kea({
    connect: {
      sagas: [function * () {
        otherConnectedRan = true
      }]
    },
    sagas: [connectedSagaLogic],
    start: function * () {
      sagaRan = true
    }
  })
  sagaMiddleware.run(sagaLogic2.saga)

  expect(sagaRan).toBe(true)
  expect(connectedSagaRan).toBe(true)
  expect(otherConnectedRan).toBe(true)

  // connect without specifiying '.saga'

  sagaRan = false
  connectedSagaRan = false
  const sagaLogic3 = kea({
    sagas: [connectedSagaLogic],
    start: function * () {
      sagaRan = true
    }
  })
  sagaMiddleware.run(sagaLogic3.saga)

  expect(sagaRan).toBe(true)
  expect(connectedSagaRan).toBe(true)
})

test('sagas get connected actions', () => {
  let sagaRan = false
  let connectedSagaRan = false

  const reducers = combineReducers({
    scenes: keaReducer('scenes')
  })

  const connectedSagaLogic = kea({
    path: () => ['scenes', 'saga', 'connected'],
    actions: () => ({
      randomAction: true
    }),
    start: function * () {
      expect(this.path).toEqual(['scenes', 'saga', 'connected'])
      expect(Object.keys(this.actions)).toEqual(['randomAction'])
      connectedSagaRan = true
    }
  })

  const sagaLogic = kea({
    connect: {
      actions: [
        connectedSagaLogic, [
          'randomAction'
        ]
      ],
      sagas: [
        connectedSagaLogic
      ]
    },
    path: () => ['scenes', 'saga', 'base'],
    actions: () => ({
      myAction: true
    }),
    start: function * () {
      expect(this.path).toEqual(['scenes', 'saga', 'base'])
      expect(Object.keys(this.actions).sort()).toEqual(['myAction', 'randomAction'])
      sagaRan = true
    }
  })

  expect(sagaLogic._isKeaSingleton).toBe(true)
  expect(sagaLogic._hasKeaConnect).toBe(true)
  expect(sagaLogic._hasKeaLogic).toBe(true)
  expect(sagaLogic._hasKeaSaga).toBe(true)

  expect(sagaLogic.saga).toBeDefined()

  expect(sagaRan).toBe(false)

  const sagaMiddleware = createSagaMiddleware()
  const finalCreateStore = compose(
    applyMiddleware(sagaMiddleware)
  )(createStore)

  finalCreateStore(reducers)

  sagaMiddleware.run(keaSaga)
  sagaMiddleware.run(sagaLogic.saga)

  expect(sagaRan).toBe(true)
  expect(connectedSagaRan).toBe(true)
})

test('get from connected kea instances', () => {
  let sagaRan = false
  let connectedSagaRan = false

  const reducers = combineReducers({
    scenes: keaReducer('scenes')
  })

  const connectedSagaLogic = kea({
    path: () => ['scenes', 'saga', 'connected'],
    actions: () => ({
      updateValue: (number) => ({ number })
    }),
    reducers: ({ actions }) => ({
      connectedValue: [0, PropTypes.number, {
        [actions.updateValue]: (_, payload) => payload.number
      }]
    }),
    start: function * () {
      const { updateValue } = this.actions
      yield take(updateValue().toString)

      expect(yield this.get('connectedValue')).toBe(4)

      connectedSagaRan = true
    }
  })

  const sagaLogic = kea({
    connect: {
      actions: [
        connectedSagaLogic, [
          'updateValue'
        ]
      ],
      props: [
        connectedSagaLogic, [
          'connectedValue'
        ]
      ],
      sagas: [
        connectedSagaLogic
      ]
    },
    path: () => ['scenes', 'saga', 'base'],
    actions: () => ({
      myAction: true
    }),
    start: function * () {
      const { updateValue, myAction } = this.actions

      expect(updateValue).toBeDefined()
      expect(myAction).toBeDefined()

      expect(yield this.get('connectedValue')).toBe(0)
      expect(yield connectedSagaLogic.get('connectedValue')).toBe(0)
      yield put(updateValue(4))
      expect(yield connectedSagaLogic.get('connectedValue')).toBe(4)
      expect(yield this.get('connectedValue')).toBe(4)

      sagaRan = true
    }
  })

  expect(sagaRan).toBe(false)

  const sagaMiddleware = createSagaMiddleware()
  const finalCreateStore = compose(
    applyMiddleware(sagaMiddleware)
  )(createStore)

  finalCreateStore(reducers)

  sagaMiddleware.run(keaSaga)
  sagaMiddleware.run(sagaLogic.saga)

  expect(sagaRan).toBe(true)
  expect(connectedSagaRan).toBe(true)
})
